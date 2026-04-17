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
import { SkipCampusCheck } from '../common/decorators/skip-campus-check.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

type AuthedRequest = Request & { user: { userId: string } };

@Controller('roles')
@SkipCampusCheck()
@Roles(ROLE_ADMIN)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list(@Query() query: ListRolesQueryDto) {
    return this.roles.list(query);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateRoleDto) {
    return this.roles.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roles.update(id, req.user.userId, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.roles.remove(id, req.user.userId);
  }
}
