import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SocialAccount,
  SocialProvider,
} from './entities/social-account.entity';
import { UsersService } from '../users/users.service';
import { TokenService } from '../auth/services/token.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class SocialAuthService {
  constructor(
    @InjectRepository(SocialAccount)
    private socialAccountRepository: Repository<SocialAccount>,
    private usersService: UsersService,
    private tokenService: TokenService,
  ) {}

  async handleSocialAuth(
    provider: SocialProvider,
    providerId: string,
    email: string,
    firstName: string,
    lastName: string,
    profileData: any,
    accessToken?: string,
    refreshToken?: string,
  ) {
    // Check if social account already exists
    let socialAccount = await this.socialAccountRepository.findOne({
      where: { provider, providerId },
      relations: ['user'],
    });

    if (socialAccount) {
      // Update existing social account
      socialAccount.accessToken = accessToken;
      socialAccount.refreshToken = refreshToken;
      socialAccount.profileData = profileData;
      await this.socialAccountRepository.save(socialAccount);

      // Generate tokens for existing user
      const tokens = await this.tokenService.generateTokens(socialAccount.user);
      return {
        user: socialAccount.user,
        tokens,
        isNewUser: false,
      };
    }

    // Check if user with this email exists
    let user = await this.usersService.findByEmail(email);

    if (!user) {
      // Create new user
      user = await this.usersService.create({
        email,
        firstName,
        lastName,
        password: this.generateRandomPassword(), // Random password for social users
      });

      // Mark as verified since social provider has verified the email
      user.isVerified = true;
      await this.usersService.update(user.id, { isVerified: true });
    }

    // Create social account
    socialAccount = this.socialAccountRepository.create({
      user,
      provider,
      providerId,
      accessToken,
      refreshToken,
      profileData,
    });

    await this.socialAccountRepository.save(socialAccount);

    // Generate tokens
    const tokens = await this.tokenService.generateTokens(user);

    return {
      user,
      tokens,
      isNewUser: !user.lastLogin, // Consider user new if they haven't logged in before
    };
  }

  async linkSocialAccount(
    userId: string,
    provider: SocialProvider,
    providerId: string,
    accessToken?: string,
    refreshToken?: string,
    profileData?: any,
  ) {
    const user = await this.usersService.findOne(userId);

    // Check if this social account is already linked to another user
    const existingAccount = await this.socialAccountRepository.findOne({
      where: { provider, providerId },
    });

    if (existingAccount) {
      throw new ConflictException(
        'This social account is already linked to another user',
      );
    }

    // Check if user already has this provider linked
    const userSocialAccount = await this.socialAccountRepository.findOne({
      where: { user: { id: userId }, provider },
    });

    if (userSocialAccount) {
      throw new ConflictException(
        `${provider} account is already linked to this user`,
      );
    }

    // Create new social account link
    const socialAccount = this.socialAccountRepository.create({
      user,
      provider,
      providerId,
      accessToken,
      refreshToken,
      profileData,
    });

    await this.socialAccountRepository.save(socialAccount);

    return { message: `${provider} account linked successfully` };
  }

  async unlinkSocialAccount(userId: string, provider: SocialProvider) {
    const socialAccount = await this.socialAccountRepository.findOne({
      where: { user: { id: userId }, provider },
    });

    if (!socialAccount) {
      throw new ConflictException(`No ${provider} account linked to this user`);
    }

    await this.socialAccountRepository.remove(socialAccount);

    return { message: `${provider} account unlinked successfully` };
  }

  async getUserSocialAccounts(userId: string): Promise<SocialAccount[]> {
    return await this.socialAccountRepository.find({
      where: { user: { id: userId } },
    });
  }

  private generateRandomPassword(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }
}
