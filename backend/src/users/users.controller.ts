import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_ADMIN } from '../common/constants/role-codes';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('users')
@Roles(ROLE_ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.users.detail(id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateUserDto) {
    return this.users.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.users.remove(id, req.user.userId);
  }
}
