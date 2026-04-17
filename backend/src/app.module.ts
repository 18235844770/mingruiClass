import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CampusesModule } from './campuses/campuses.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { CampusGuard } from './common/guards/campus.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConsumptionsModule } from './consumptions/consumptions.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LogsModule } from './logs/logs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { StudentCoursesModule } from './student-courses/student-courses.module';
import { StudentsModule } from './students/students.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    CampusesModule,
    StudentsModule,
    StudentCoursesModule,
    ConsumptionsModule,
    DashboardModule,
    ReportsModule,
    LogsModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CampusGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
