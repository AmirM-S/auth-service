import { Controller } from '@nestjs/common';
import { MfaService } from './mfa.service';

@Controller('mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}
}
