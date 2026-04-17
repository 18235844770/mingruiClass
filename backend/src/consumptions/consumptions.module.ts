import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { ConsumptionsController } from './consumptions.controller';
import { ConsumptionsService } from './consumptions.service';

@Module({
  imports: [LogsModule],
  controllers: [ConsumptionsController],
  providers: [ConsumptionsService],
})
export class ConsumptionsModule {}
