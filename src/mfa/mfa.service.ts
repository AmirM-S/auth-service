import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { UserMfa, MfaType } from './entities/user-mfa.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(UserMfa)
    private userMfaRepository: Repository<UserMfa>,
    private usersService: UsersService,
  ) {}

  async enableTotp(userId: string): Promise<{ secret: string; qrCode: string; backupCodes: string[] }> {
    const user = await this.usersService.findOne(userId);
    
    // Check if TOTP is already enabled
    const existingMfa = await this.userMfaRepository.findOne({
      where: { userId, type: MfaType.TOTP },
    });

    if (existingMfa && existingMfa.isEnabled) {
      throw new BadRequestException('TOTP is already enabled for this user');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Enterprise Auth (${user.email})`,
      issuer: 'Enterprise Auth Service',
      length: 32,
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Encrypt sensitive data
    const encryptedSecret = this.encrypt(secret.base32);
    const encryptedBackupCodes = backupCodes.map(code => this.encrypt(code));

    // Save or update MFA settings
    if (existingMfa) {
      existingMfa.secret = encryptedSecret;
      existingMfa.backupCodes = encryptedBackupCodes;
      await this.userMfaRepository.save(existingMfa);
    } else {
      const userMfa = this.userMfaRepository.create({
        userId,
        type: MfaType.TOTP,
        secret: encryptedSecret,
        backupCodes: encryptedBackupCodes,
        isEnabled: false,
      });
      await this.userMfaRepository.save(userMfa);
    }

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode,
      backupCodes,
    };
  }

  async verifyTotp(userId: string, token: string): Promise<{ verified: boolean; backupCodes?: string[] }> {
    const userMfa = await this.userMfaRepository.findOne({
      where: { userId, type: MfaType.TOTP },
    });

    if (!userMfa) {
      throw new NotFoundException('TOTP not configured for this user');
    }

    const decryptedSecret = this.decrypt(userMfa.secret);
    
    const verified = speakeasy.totp.verify({
      secret: decryptedSecret,
      token,
      window: 2, // Allow 2 time steps (60 seconds) of drift
    });

    if (verified) {
      // Enable MFA if not already enabled
      if (!userMfa.isEnabled) {
        userMfa.isEnabled = true;
        userMfa.verifiedAt = new Date();
        await this.userMfaRepository.save(userMfa);

        // Return backup codes only on first verification
        const backupCodes = userMfa.backupCodes.map(code => this.decrypt(code));
        return { verified: true, backupCodes };
      }

      return { verified: true };
    }

    return { verified: false };
  }

  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const userMfa = await this.userMfaRepository.findOne({
      where: { userId, type: MfaType.TOTP },
    });

    if (!userMfa || !userMfa.isEnabled) {
      return false;
    }

    const backupCodes = userMfa.backupCodes.map(encryptedCode => this.decrypt(encryptedCode));
    const codeIndex = backupCodes.indexOf(code);

    if (codeIndex === -1) {
      return false;
    }

    // Remove used backup code
    userMfa.backupCodes.splice(codeIndex, 1);
    await this.userMfaRepository.save(userMfa);

    return true;
  }

  async disableMfa(userId: string, type: MfaType = MfaType.TOTP): Promise<void> {
    const userMfa = await this.userMfaRepository.findOne({
      where: { userId, type },
    });

    if (!userMfa) {
      throw new NotFoundException('MFA not configured for this user');
    }

    await this.userMfaRepository.remove(userMfa);
  }

  async getMfaStatus(userId: string): Promise<{ enabled: boolean; types: MfaType[] }> {
    const userMfaSettings = await this.userMfaRepository.find({
      where: { userId, isEnabled: true },
    });

    return {
      enabled: userMfaSettings.length > 0,
      types: userMfaSettings.map(setting => setting.type),
    };
  }

  async generateNewBackupCodes(userId: string): Promise<string[]> {
    const userMfa = await this.userMfaRepository.findOne({
      where: { userId, type: MfaType.TOTP, isEnabled: true },
    });

    if (!userMfa) {
      throw new NotFoundException('TOTP not enabled for this user');
    }

    const backupCodes = this.generateBackupCodes();
    const encryptedBackupCodes = backupCodes.map(code => this.encrypt(code));

    userMfa.backupCodes = encryptedBackupCodes;
    await this.userMfaRepository.save(userMfa);

    return backupCodes;
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      // Generate 8-digit backup codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  private encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encrypted = textParts.join(':');
    const decipher = crypto.createDecipher(algorithm, key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}