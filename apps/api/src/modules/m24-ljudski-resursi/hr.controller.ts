import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  HrService,
  type CreateLeaveRecordDto,
  type UpsertEmployeeRecordDto,
  type UpsertLeaveEntitlementDto,
} from './hr.service';
import { JwtAuthGuard } from '../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// M24 spec §5 — prefiks /api/v1/hr. Rute za sopstveni zahtev/uvid namerno BEZ
// @RequirePermission — ownership provera (actorId === userId, ili actorId === odobravalac)
// živi u servisu, isti obrazac kao Gost koji vidi sopstvenu rezervaciju (M5 §6.6).
@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('hr')
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('employees/:userId')
  async getEmployee(@Param('userId') userId: string, @CurrentUser() actor: { userId: string }) {
    await this.hr.assertCanView(userId, actor.userId);
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
  async listLeave(@Param('userId') userId: string, @CurrentUser() actor: { userId: string }) {
    await this.hr.assertCanView(userId, actor.userId);
    return this.hr.listLeaveRecords(userId);
  }

  // M24 spec §3a — sopstveni zahtev (ownership) ili u ime nekog drugog (M24/leave-record/CREATE)
  // — oba puta proverena u servisu, ruta namerno bez @RequirePermission.
  @Post('employees/:userId/leave')
  createLeave(
    @Param('userId') userId: string,
    @Body() dto: CreateLeaveRecordDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.hr.createLeaveRecord(userId, dto, actor.userId);
  }

  @Get('employees/:userId/leave-balance')
  async getLeaveBalance(
    @Param('userId') userId: string,
    @Query('year') year: string | undefined,
    @CurrentUser() actor: { userId: string },
  ) {
    await this.hr.assertCanView(userId, actor.userId);
    return this.hr.getLeaveBalance(userId, year ? Number(year) : undefined);
  }

  // M24 spec §2.2a (predlog v1.5) — dodeljeni dani PO GODINI, iste dozvole kao EmployeeRecord.
  @Get('employees/:userId/leave-entitlements')
  async listLeaveEntitlements(
    @Param('userId') userId: string,
    @CurrentUser() actor: { userId: string },
  ) {
    await this.hr.assertCanView(userId, actor.userId);
    return this.hr.listLeaveEntitlements(userId);
  }

  @Put('employees/:userId/leave-entitlements/:year')
  @RequirePermission('M24', 'employee-record', 'EDIT')
  upsertLeaveEntitlement(
    @Param('userId') userId: string,
    @Param('year') year: string,
    @Body() dto: UpsertLeaveEntitlementDto,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.hr.upsertLeaveEntitlement(userId, Number(year), dto, actor.userId);
  }

  // M24 spec §3a — odobravalac (reportsToUserId) ili M24/leave-record/CREATE (blanket),
  // provereno u servisu.
  @Patch('leave/:leaveId/approve')
  approveLeave(@Param('leaveId') leaveId: string, @CurrentUser() actor: { userId: string }) {
    return this.hr.approveLeaveRecord(leaveId, actor.userId);
  }

  @Patch('leave/:leaveId/reject')
  rejectLeave(
    @Param('leaveId') leaveId: string,
    @Body('reason') reason: string,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.hr.rejectLeaveRecord(leaveId, reason, actor.userId);
  }

  // M24 spec §3b — timski kalendar; vidljivost (APPROVED svima, PENDING actor-relevantno)
  // sprovodi servis, ne kontroler.
  @Get('leave/calendar')
  getCalendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() actor: { userId: string },
  ) {
    return this.hr.getTeamCalendar(actor.userId, from, to, branchId);
  }
}
