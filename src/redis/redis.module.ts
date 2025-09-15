import { Module, DynamicModule } from '@nestjs/common';
import { RedisService } from './redis.service';
import Redis from 'ioredis';

export interface RedisModuleOptions {
  host: string;
  port: number;
  password?: string;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
}

@Module({})
export class RedisModule {
  static forRootAsync(options: {
    imports?: any[];
    useFactory: (...args: any[]) => Promise<RedisModuleOptions> | RedisModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: RedisModule,
      imports: options.imports,
      providers: [
        {
          provide: 'REDIS_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject,
        },
        {
          provide: 'REDIS_CLIENT',
          useFactory: (redisOptions: RedisModuleOptions) => {
            return new Redis(redisOptions);
          },
          inject: ['REDIS_OPTIONS'],
        },
        RedisService,
      ],
      exports: [RedisService],
      global: true,
    };
  }
}