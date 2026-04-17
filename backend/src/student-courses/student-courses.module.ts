import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { StudentCoursesController } from './student-courses.controller';
import { StudentCoursesService } from './student-courses.service';

@Module({
  imports: [LogsModule],
  controllers: [StudentCoursesController],
  providers: [StudentCoursesService],
})
export class StudentCoursesModule {}
