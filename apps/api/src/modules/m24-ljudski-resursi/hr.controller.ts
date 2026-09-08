import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  HrService,
  type CreateLeaveRecordDto,
  type UpsertEmployeeRecordDto,
} from './hr.service';
import { JwtAuthGuard } from '../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// M24 spec §5 — prefiks /api/v1/hr.
@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('employees/:userId')
  @RequirePermission('M24', 'employee-record', 'VIEW')
  getEmployee(@Param('userId') userId: string) {
    return this.hr.getEmployeeRecord(userId);
  }

  @Patch('employees/:userId')
  @RequirePermission('M24', 'employee-record', 'EDIT')
  upsertEmployee(
    @Param('userId') userId: string,
    @Body() dto: UpsertEmployeeRecordDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.hr.upsertEmployeeRecord(userId, dto, actor.userId);
  }

  @Get('employees/:userId/leave')
  @RequirePermission('M24', 'employee-record', 'VIEW')
  listLeave(@Param('userId') userId: string) {
    return this.hr.listLeaveRecords(userId);
  }

  @Post('employees/:userId/leave')
  @RequirePermission('M24', 'leave-record', 'CREATE')
  createLeave(
    @Param('userId') userId: string,
    @Body() dto: CreateLeaveRecordDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.hr.createLeaveRecord(userId, dto, actor.userId);
  }

  @Get('employees/:userId/leave-balance')
  @RequirePermission('M24', 'employee-record', 'VIEW')
  getLeaveBalance(@Param('userId') userId: string) {
    return this.hr.getLeaveBalance(userId);
  }
}
