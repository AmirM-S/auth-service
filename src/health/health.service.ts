import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class HealthService {
  constructor(
    @InjectConnection() private connection: Connection,
    private redisService: RedisService,
  ) {}

  async checkHealth() {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
      },
    };

    const allServicesHealthy = Object.values(health.services).every(
      service => service.status === 'healthy'
    );

    health.status = allServicesHealthy ? 'ok' : 'degraded';

    return health;
  }

  private async checkDatabase() {
    try {
      await this.connection.query('SELECT 1');
      return { status: 'healthy', responseTime: Date.now() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }

  private async checkRedis() {
    try {
      const start = Date.now();
      await this.redisService.set('health_check', 'ok', 10);
      await this.redisService.get('health_check');
      await this.redisService.del('health_check');
      
      return { 
        status: 'healthy', 
        responseTime: Date.now() - start 
      };
    } catch (error) {
      return { status: 'unhealthy', error: error.message };
    }
  }
}