import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [LogsModule],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
