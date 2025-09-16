import { Module } from '@nestjs/common';
import { SocialAuthService } from './social-auth.service';
import { SocialAuthController } from './social-auth.controller';

@Module({
  controllers: [SocialAuthController],
  providers: [SocialAuthService],
})
export class SocialAuthModule {}
