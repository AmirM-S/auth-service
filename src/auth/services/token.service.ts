import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { RefreshToken } from '../entities/refresh-token.entity';
import { User } from '../../users/entities/user.entity';
import { RedisService } from '../../redis/redis.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class TokenService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async generateTokens(user: User, deviceInfo?: string, ipAddress?: string): Promise<TokenPair> {
    const payload = {
      sub: user.id,
      email: user.email,
      roles: user.roles?.map(role => role.name) || [],
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = crypto.randomBytes(32).toString('hex');

    // Store refresh token in database
    const refreshTokenEntity = this.refreshTokenRepository.create({
      user,
      tokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.getRefreshTokenTTL()),
      deviceInfo,
      ipAddress,
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    // Store access token in Redis for quick validation
    await this.redisService.set(
      `access_token:${user.id}:${this.hashToken(accessToken)}`,
      'valid',
      15 * 60 // 15 minutes TTL
    );

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair | null> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { tokenHash, isRevoked: false },
      relations: ['user', 'user.roles'],
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return null;
    }

    // Revoke old refresh token
    storedToken.isRevoked = true;
    await this.refreshTokenRepository.save(storedToken);

    // Generate new tokens
    return this.generateTokens(
      storedToken.user,
      storedToken.deviceInfo,
      storedToken.ipAddress,
    );
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenRepository.update(
      { tokenHash },
      { isRevoked: true }
    );
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.update(
      { user: { id: userId } },
      { isRevoked: true }
    );

    // Remove all access tokens from Redis
    const keys = await this.redisService.keys(`access_token:${userId}:*`);
    if (keys.length > 0) {
      await Promise.all(keys.map(key => this.redisService.del(key)));
    }
  }

  async isAccessTokenValid(token: string, userId: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const exists = await this.redisService.exists(`access_token:${userId}:${tokenHash}`);
    return exists === 1;
  }

  async blacklistAccessToken(token: string, userId: string): Promise<void> {
    const tokenHash = this.hashToken(token);
    await this.redisService.del(`access_token:${userId}:${tokenHash}`);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenTTL(): number {
    const ttl = this.configService.get('JWT_REFRESH_EXPIRATION', '7d');
    return this.parseDuration(ttl);
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'm': return value * 60 * 1000;
      case 's': return value * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }
}