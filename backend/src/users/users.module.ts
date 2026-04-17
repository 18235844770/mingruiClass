import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [LogsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
