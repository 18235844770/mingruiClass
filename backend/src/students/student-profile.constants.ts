/** 与库内 students.grade 一致的可选值 */
export const STUDENT_GRADES = [
  '幼儿园小班',
  '幼儿园中班',
  '幼儿园大班',
  '一年级',
  '二年级',
  '三年级',
  '四年级',
  '五年级',
  '六年级',
  '初一',
  '初二',
  '初三',
  '高一',
  '高二',
  '高三',
] as const;

export const STUDENT_GENDERS = ['男', '女'] as const;

export type StudentGradeValue = (typeof STUDENT_GRADES)[number];
export type StudentGenderValue = (typeof STUDENT_GENDERS)[number];

export const STUDENT_GRADE_LIST = [...STUDENT_GRADES] as string[];
export const STUDENT_GENDER_LIST = [...STUDENT_GENDERS] as string[];
