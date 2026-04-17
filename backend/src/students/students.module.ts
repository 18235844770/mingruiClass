import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [LogsModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
