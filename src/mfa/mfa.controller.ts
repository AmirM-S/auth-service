import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MfaService } from './mfa.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('MFA')
@Controller('mfa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('enable-totp')
  @ApiOperation({ summary: 'Enable TOTP MFA' })
  @ApiResponse({ status: 200, description: 'TOTP setup initiated' })
  async enableTotp(@Request() req) {
    return this.mfaService.enableTotp(req.user.id);
  }

  @Post('verify-totp')
  @ApiOperation({ summary: 'Verify TOTP code' })
  @ApiResponse({ status: 200, description: 'TOTP verified successfully' })
  async verifyTotp(@Request() req, @Body() { token }: { token: string }) {
    return this.mfaService.verifyTotp(req.user.id, token);
  }

  @Post('verify-backup')
  @ApiOperation({ summary: 'Verify backup code' })
  @ApiResponse({ status: 200, description: 'Backup code verified' })
  async verifyBackupCode(@Request() req, @Body() { code }: { code: string }) {
    const verified = await this.mfaService.verifyBackupCode(req.user.id, code);
    return { verified };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get MFA status' })
  @ApiResponse({ status: 200, description: 'MFA status retrieved' })
  async getMfaStatus(@Request() req) {
    return this.mfaService.getMfaStatus(req.user.id);
  }

  @Post('backup-codes')
  @ApiOperation({ summary: 'Generate new backup codes' })
  @ApiResponse({ status: 200, description: 'New backup codes generated' })
  async generateBackupCodes(@Request() req) {
    const backupCodes = await this.mfaService.generateNewBackupCodes(req.user.id);
    return { backupCodes };
  }

  @Delete('disable')
  @ApiOperation({ summary: 'Disable MFA' })
  @ApiResponse({ status: 200, description: 'MFA disabled successfully' })
  async disableMfa(@Request() req) {
    await this.mfaService.disableMfa(req.user.id);
    return { message: 'MFA disabled successfully' };
  }
}