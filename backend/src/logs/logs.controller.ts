import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ROLE_ADMIN, ROLE_OWNER } from '../common/constants/role-codes';
import { Roles } from '../common/decorators/roles.decorator';
import { ListLogsQueryDto } from './dto/list-logs-query.dto';
import { LogsService } from './logs.service';

@Controller('logs')
@Roles(ROLE_ADMIN, ROLE_OWNER)
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  @Get('operators')
  operators() {
    return this.logs.listOperators();
  }

  @Get()
  list(@Query() query: ListLogsQueryDto) {
    return this.logs.list(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.logs.detail(id);
  }

  @Delete(':id')
  @Roles(ROLE_ADMIN)
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.logs.remove(id);
  }
}
