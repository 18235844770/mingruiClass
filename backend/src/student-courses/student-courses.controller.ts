import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ROLE_ADMIN, ROLE_SALES } from '../common/constants/role-codes';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateStudentCoursesDto } from './dto/create-student-courses.dto';
import { StudentCoursesService } from './student-courses.service';

type CampusRequest = Request & {
  user: { userId: string; roleCode: string };
  campusId?: string;
};

@Controller('students/:studentId/courses')
@Roles(ROLE_ADMIN, ROLE_SALES)
export class StudentCoursesController {
  constructor(private readonly studentCourses: StudentCoursesService) {}

  @Post()
  createBatch(
    @Param('studentId', new ParseUUIDPipe()) studentId: string,
    @Req() req: CampusRequest,
    @Body() dto: CreateStudentCoursesDto,
  ) {
    return this.studentCourses.createBatchByScope(
      {
        userId: req.user.userId,
        roleCode: req.user.roleCode,
        campusId: req.campusId,
      },
      studentId,
      dto,
    );
  }
}
