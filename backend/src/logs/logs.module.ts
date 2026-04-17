import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { OperationLogsService } from './operation-logs.service';

@Module({
  controllers: [LogsController],
  providers: [LogsService, OperationLogsService],
  exports: [OperationLogsService],
})
export class LogsModule {}
