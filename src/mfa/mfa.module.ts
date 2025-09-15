import { Module } from '@nestjs/common';
import { MfaService } from './mfa.service';
import { MfaController } from './mfa.controller';

@Module({
  controllers: [MfaController],
  providers: [MfaService],
})
export class MfaModule {}
