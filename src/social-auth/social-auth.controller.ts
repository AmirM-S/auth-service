import { Controller } from '@nestjs/common';
import { SocialAuthService } from './social-auth.service';

@Controller('social-auth')
export class SocialAuthController {
  constructor(private readonly socialAuthService: SocialAuthService) {}
}
