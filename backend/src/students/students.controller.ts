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
import { Roles } from '../common/decorators/roles.decorator';
import { ROLE_ADMIN, ROLE_SALES } from '../common/constants/role-codes';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students-query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentsService } from './students.service';

type CampusRequest = Request & {
  user: { userId: string; roleCode: string };
  campusId?: string;
};

@Controller('students')
@Roles(ROLE_ADMIN, ROLE_SALES)
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get()
  list(@Req() req: CampusRequest, @Query() query: ListStudentsQueryDto) {
    return this.students.listByScope({
      user: {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      query,
    });
  }

  @Get(':id')
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: CampusRequest,
  ) {
    return this.students.detailByScope(
      {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      id,
    );
  }

  @Post()
  create(@Req() req: CampusRequest, @Body() dto: CreateStudentDto) {
    return this.students.createByScope(
      {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      dto,
    );
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: CampusRequest,
    @Body() dto: UpdateStudentDto,
  ) {
    return this.students.updateByScope(
      {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      id,
      dto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: CampusRequest,
  ) {
    return this.students.removeByScope(
      {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      id,
    );
  }
}
