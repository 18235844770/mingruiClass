import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { CampusesController } from './campuses.controller';
import { CampusesService } from './campuses.service';

@Module({
  imports: [LogsModule],
  controllers: [CampusesController],
  providers: [CampusesService],
})
export class CampusesModule {}
