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
import { ROLE_ADMIN, ROLE_SALES } from '../common/constants/role-codes';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipCampusCheck } from '../common/decorators/skip-campus-check.decorator';
import { CreateCampusDto } from './dto/create-campus.dto';
import { ListCampusesQueryDto } from './dto/list-campuses-query.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import { CampusesService } from './campuses.service';

type AuthedRequest = Request & { user: { userId: string; roleCode: string } };

@Controller('campuses')
@SkipCampusCheck()
export class CampusesController {
  constructor(private readonly campuses: CampusesService) {}

  @Roles(ROLE_ADMIN)
  @Get()
  list(@Query() query: ListCampusesQueryDto) {
    return this.campuses.list(query);
  }

  @Roles(ROLE_ADMIN)
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateCampusDto) {
    return this.campuses.create(req.user.userId, dto);
  }

  @Roles(ROLE_ADMIN)
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
    @Body() dto: UpdateCampusDto,
  ) {
    return this.campuses.update(id, req.user.userId, dto);
  }

  @Roles(ROLE_ADMIN)
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthedRequest,
  ) {
    return this.campuses.remove(id, req.user.userId);
  }

  @Roles(ROLE_ADMIN, ROLE_SALES)
  @Get('mine')
  mine(@Req() req: AuthedRequest) {
    return this.campuses.findMine(req.user.userId).then((rows) =>
      rows.map((r) => ({
        id: r.campus.id,
        name: r.campus.name,
        status: r.campus.status,
      })),
    );
  }
}
