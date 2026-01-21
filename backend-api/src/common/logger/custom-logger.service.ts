import { Injectable } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Injectable()
export class CustomLoggerService extends LoggerService {
  // CustomLoggerService is an alias for LoggerService
}
