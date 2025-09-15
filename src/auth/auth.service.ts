import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { TokenService } from './services/token.service';
import { SecurityService } from './services/security.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthEventType } from './entities/auth-event.entity';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private mailService: MailService,
    private tokenService: TokenService,
    private securityService: SecurityService,
  ) {}

  async register(registerDto: RegisterDto, ipAddress?: string, userAgent?: string) {
    // Check rate limiting
    const canAttempt = await this.securityService.checkRateLimit(
      `register:${ipAddress}`,
      5,
      60 * 60 * 1000 // 1 hour
    );

    if (!canAttempt) {
      throw new BadRequestException('تعداد تلاش‌ های ثبت ‌نام بیش از حد مجاز است. لطفاً بعداً دوباره امتحان کنید.');
    }

    try {
      const user = await this.usersService.create(registerDto);

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.usersService.setEmailVerificationToken(
        user.id,
        verificationToken,
        verificationExpires,
      );

      // Send verification email
      await this.mailService.sendVerificationEmail(user.email, verificationToken);

      // Log successful registration
      await this.securityService.logAuthEvent(
        AuthEventType.LOGIN_SUCCESS,
        true,
        ipAddress,
        userAgent,
        user,
        { action: 'register' }
      );

      return {
        message: 'ثبت‌ نام با موفقیت انجام شد. لطفاً ایمیل خود را برای تأیید حساب بررسی کنید.',
        userId: user.id,
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      await this.securityService.logAuthEvent(
        AuthEventType.LOGIN_FAILED,
        false,
        ipAddress,
        userAgent,
        null,
        { action: 'register', error: error.message }
      );

  throw new BadRequestException('ثبت‌ نام انجام نشد');
    }
  }

  async login(loginDto: LoginDto, ipAddress?: string, userAgent?: string, deviceInfo?: string) {
    // Check if IP is blocked
    if (await this.securityService.isBlocked(ipAddress)) {
      throw new UnauthorizedException('دسترسی این IP به دلیل فعالیت مشکوک به طور موقت مسدود شده است');
    }

    // Check rate limiting
    const canAttempt = await this.securityService.checkRateLimit(`login:${ipAddress}`, 10, 15 * 60 * 1000);
    if (!canAttempt) {
      throw new UnauthorizedException('تعداد تلاش‌ های ورود بیش از حد مجاز است. لطفاً بعداً دوباره امتحان کنید.');
    }

    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      await this.securityService.recordLoginAttempt(loginDto.email);
      await this.securityService.recordLoginAttempt(ipAddress);
      
      await this.securityService.logAuthEvent(
        AuthEventType.LOGIN_FAILED,
        false,
        ipAddress,
        userAgent,
        null,
        { email: loginDto.email }
      );

  throw new UnauthorizedException('اطلاعات ورود نامعتبر است');
    }

    // Check if account is locked
    if (user.isLocked) {
      await this.securityService.logAuthEvent(
        AuthEventType.LOGIN_FAILED,
        false,
        ipAddress,
        userAgent,
        user,
        { reason: 'account_locked' }
      );

      throw new UnauthorizedException('حساب کاربری به طور موقت قفل شده است');
    }

    // Check if account needs verification
    if (!user.isVerified) {
      throw new UnauthorizedException('لطفاً قبل از ورود، ایمیل خود را تأیید کنید');
    }

    // Detect suspicious activity
    const isSuspicious = await this.securityService.detectSuspiciousActivity(user, ipAddress, userAgent);
    if (isSuspicious) {
      // Could implement additional verification steps here
    }

    // Clear failed login attempts
    await this.securityService.clearLoginAttempts(loginDto.email);
    await this.securityService.clearLoginAttempts(ipAddress);

    // Update last login
    await this.usersService.updateLastLogin(user.id);
    await this.usersService.resetFailedLoginAttempts(user.id);

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user, deviceInfo, ipAddress);

    // Log successful login
    await this.securityService.logAuthEvent(
      AuthEventType.LOGIN_SUCCESS,
      true,
      ipAddress,
      userAgent,
      user
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        roles: user.roles?.map(role => role.name) || [],
      },
      tokens,
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await this.usersService.verifyPassword(user, password);
    if (!isPasswordValid) {
      // Increment failed login attempts
      await this.usersService.incrementFailedLoginAttempts(user.id);
      
      // Lock account after 5 failed attempts
      if (user.failedLoginAttempts >= 4) { // Will be 5 after increment
        await this.usersService.lockUser(user.id);
      }
      
      return null;
    }

    return user;
  }

  async refreshTokens(refreshToken: string) {
    const tokens = await this.tokenService.refreshTokens(refreshToken);
    if (!tokens) {
      throw new UnauthorizedException('توکن نامعتبر است');
    }

    return tokens;
  }

  async logout(refreshToken: string, userId: string, ipAddress?: string, userAgent?: string) {
    await this.tokenService.revokeRefreshToken(refreshToken);

    const user = await this.usersService.findOne(userId);
    await this.securityService.logAuthEvent(
      AuthEventType.LOGOUT,
      true,
      ipAddress,
      userAgent,
      user
    );

  return { message: 'خروج با موفقیت انجام شد' };
  }

  async logoutAll(userId: string, ipAddress?: string, userAgent?: string) {
    await this.tokenService.revokeAllUserTokens(userId);

    const user = await this.usersService.findOne(userId);
    await this.securityService.logAuthEvent(
      AuthEventType.LOGOUT,
      true,
      ipAddress,
      userAgent,
      user,
      { action: 'logout_all' }
    );

  return { message: 'خروج از همه دستگاه‌ها با موفقیت انجام شد' };
  }

  async verifyEmail(token: string) {
    const user = await this.usersService.verifyEmail(token);
    
    await this.securityService.logAuthEvent(
      AuthEventType.EMAIL_VERIFIED,
      true,
      null,
      null,
      user
    );

  return { message: 'ایمیل با موفقیت تأیید شد' };
  }

  async forgotPassword(email: string, ipAddress?: string) {
    // Rate limiting for password reset requests
    const canAttempt = await this.securityService.checkRateLimit(
      `forgot_password:${email}`,
      3,
      60 * 60 * 1000 // 1 hour
    );

    if (!canAttempt) {
      throw new BadRequestException('تعداد تلاش‌ های بازیابی رمز عبور بیش از حد مجاز است. لطفاً بعداً دوباره امتحان کنید.');
    }

    try {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const user = await this.usersService.setPasswordResetToken(email, resetToken, resetExpires);
      
      await this.mailService.sendPasswordResetEmail(email, resetToken);

      await this.securityService.logAuthEvent(
        AuthEventType.PASSWORD_RESET,
        true,
        ipAddress,
        null,
        user,
        { action: 'request' }
      );

  return { message: 'ایمیل بازیابی رمز عبور ارسال شد' };
    } catch (error) {
      // Don't reveal whether email exists or not
  return { message: 'ایمیل بازیابی رمز عبور ارسال شد' };
    }
  }

  async resetPassword(token: string, newPassword: string, ipAddress?: string) {
    const user = await this.usersService.resetPassword(token, newPassword);

    await this.securityService.logAuthEvent(
      AuthEventType.PASSWORD_RESET,
      true,
      ipAddress,
      null,
      user,
      { action: 'complete' }
    );

    // Revoke all existing tokens
    await this.tokenService.revokeAllUserTokens(user.id);

  return { message: 'رمز عبور با موفقیت تغییر یافت' };
  }
}