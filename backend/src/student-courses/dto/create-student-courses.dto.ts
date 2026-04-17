import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateStudentCourseItemDto } from './create-student-course-item.dto';

export class CreateStudentCoursesDto {
  /** 全量同步：包含需保留的已有课程（带 id）与新增行（不带 id）；未出现在列表中的课程将软删除（无消课记录时） */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStudentCourseItemDto)
  courses!: CreateStudentCourseItemDto[];
}
