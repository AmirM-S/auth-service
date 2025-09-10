import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { Permission } from '../users/entities/permission.entity';

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5432),
  username: configService.get('DATABASE_USERNAME', 'auth_user'),
  password: configService.get('DATABASE_PASSWORD', 'auth_password'),
  database: configService.get('DATABASE_NAME', 'auth_service'),
  entities: [User, Role, Permission],
  synchronize: configService.get('NODE_ENV') === 'development',
  logging: configService.get('NODE_ENV') === 'development',
});
