import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAuthService } from './social-auth.service';
import { SocialAuthController } from './social-auth.controller';
import { SocialAccount } from './entities/social-account.entity';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([SocialAccount]),
    PassportModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [SocialAuthController],
  providers: [SocialAuthService, GoogleStrategy],
  exports: [SocialAuthService],
})
export class SocialAuthModule {}