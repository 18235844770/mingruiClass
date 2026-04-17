import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_ADMIN, ROLE_SALES } from '../common/constants/role-codes';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateConsumptionDto } from './dto/create-consumption.dto';
import { ListConsumptionsQueryDto } from './dto/list-consumptions-query.dto';
import { ConsumptionsService } from './consumptions.service';

type CampusRequest = Request & {
  user: { userId: string; roleCode: string };
  campusId?: string;
};

@Controller('consumptions')
@Roles(ROLE_ADMIN, ROLE_SALES)
export class ConsumptionsController {
  constructor(private readonly consumptions: ConsumptionsService) {}

  @Post()
  create(@Req() req: CampusRequest, @Body() dto: CreateConsumptionDto) {
    return this.consumptions.createByScope(
      {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      dto,
    );
  }

  @Get()
  list(@Req() req: CampusRequest, @Query() query: ListConsumptionsQueryDto) {
    return this.consumptions.listByScope(
      {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      query,
    );
  }
}
