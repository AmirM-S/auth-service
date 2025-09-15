import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthEvent, AuthEventType } from '../entities/auth-event.entity';
import { LoginAttempt } from '../entities/login-attempt.entity';
import { User } from '../../users/entities/user.entity';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class SecurityService {
  constructor(
    @InjectRepository(AuthEvent)
    private authEventRepository: Repository<AuthEvent>,
    @InjectRepository(LoginAttempt)
    private loginAttemptRepository: Repository<LoginAttempt>,
    private redisService: RedisService,
  ) {}

  async logAuthEvent(
    eventType: AuthEventType,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
    user?: User,
    metadata?: any,
  ): Promise<void> {
    const authEvent = this.authEventRepository.create({
      user,
      userId: user?.id,
      eventType,
      ipAddress,
      userAgent,
      metadata,
      success,
    });

    await this.authEventRepository.save(authEvent);
  }

  async checkRateLimit(identifier: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): Promise<boolean> {
    const key = `rate_limit:${identifier}`;
    const current = await this.redisService.get(key);
    
    if (!current) {
      await this.redisService.set(key, '1', Math.floor(windowMs / 1000));
      return true;
    }

    const attempts = parseInt(current);
    if (attempts >= maxAttempts) {
      return false;
    }

    await this.redisService.incr(key);
    return true;
  }

  async recordLoginAttempt(identifier: string): Promise<LoginAttempt> {
    const existingAttempt = await this.loginAttemptRepository.findOne({
      where: { identifier },
    });

    if (existingAttempt) {
      existingAttempt.attempts += 1;
      
      // Block after 5 failed attempts for 15 minutes
      if (existingAttempt.attempts >= 5) {
        existingAttempt.blockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      return await this.loginAttemptRepository.save(existingAttempt);
    } else {
      const loginAttempt = this.loginAttemptRepository.create({
        identifier,
        attempts: 1,
      });

      return await this.loginAttemptRepository.save(loginAttempt);
    }
  }

  async clearLoginAttempts(identifier: string): Promise<void> {
    await this.loginAttemptRepository.delete({ identifier });
  }

  async isBlocked(identifier: string): Promise<boolean> {
    const attempt = await this.loginAttemptRepository.findOne({
      where: { identifier },
    });

    if (!attempt) {
      return false;
    }

    return attempt.blockedUntil && attempt.blockedUntil > new Date();
  }

  async detectSuspiciousActivity(user: User, ipAddress: string, userAgent: string): Promise<boolean> {
    // Check for multiple login attempts from different IPs
    const recentEvents = await this.authEventRepository.find({
      where: {
        userId: user.id,
        eventType: AuthEventType.LOGIN_SUCCESS,
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const uniqueIPs = new Set(recentEvents.map(event => event.ipAddress));
    
    // Flag as suspicious if more than 3 different IPs in recent logins
    if (uniqueIPs.size > 3) {
      await this.logAuthEvent(
        AuthEventType.SUSPICIOUS_ACTIVITY,
        false,
        ipAddress,
        userAgent,
        user,
        { reason: 'Multiple IP addresses', uniqueIPs: Array.from(uniqueIPs) }
      );
      return true;
    }

    return false;
  }

  async getSecuritySummary(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const events = await this.authEventRepository
      .createQueryBuilder('event')
      .where('event.userId = :userId', { userId })
      .andWhere('event.createdAt >= :startDate', { startDate })
      .orderBy('event.createdAt', 'DESC')
      .getMany();

    const summary = {
      totalEvents: events.length,
      successfulLogins: events.filter(e => e.eventType === AuthEventType.LOGIN_SUCCESS).length,
      failedLogins: events.filter(e => e.eventType === AuthEventType.LOGIN_FAILED).length,
      uniqueIPs: [...new Set(events.map(e => e.ipAddress))].length,
      suspiciousActivities: events.filter(e => e.eventType === AuthEventType.SUSPICIOUS_ACTIVITY).length,
      recentEvents: events.slice(0, 20),
    };

    return summary;
  }
}