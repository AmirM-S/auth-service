import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Req,
  Res,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { SocialAuthService } from './social-auth.service';
import { SocialProvider } from './entities/social-account.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Social Auth')
@Controller('social-auth')
export class SocialAuthController {
  constructor(private readonly socialAuthService: SocialAuthService) {}

  @Get('google')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth' })
  async googleAuth(@Req() req) {
    // Initiates Google OAuth flow
  }

  @Get('google/callback')
  @Public()
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(@Req() req, @Res() res: Response) {
    const result = await this.socialAuthService.handleSocialAuth(
      SocialProvider.GOOGLE,
      req.user.providerId,
      req.user.email,
      req.user.firstName,
      req.user.lastName,
      {
        picture: req.user.picture,
        email_verified: true,
      },
      req.user.accessToken,
      req.user.refreshToken,
    );

    // Redirect to frontend with tokens
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const redirectUrl = `${frontendUrl}/auth/callback?access_token=${result.tokens.accessToken}&refresh_token=${result.tokens.refreshToken}&new_user=${result.isNewUser}`;
    
    res.redirect(redirectUrl);
  }

  @Get('accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get linked social accounts' })
  async getSocialAccounts(@Req() req) {
    const accounts = await this.socialAuthService.getUserSocialAccounts(req.user.id);
    return {
      accounts: accounts.map(account => ({
        id: account.id,
        provider: account.provider,
        profileData: account.profileData,
        createdAt: account.createdAt,
      })),
    };
  }

  @Delete('unlink/:provider')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink social account' })
  async unlinkAccount(@Req() req, @Param('provider') provider: SocialProvider) {
    return this.socialAuthService.unlinkSocialAccount(req.user.id, provider);
  }
}