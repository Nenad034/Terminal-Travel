import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SupplierPaymentInstructionsService } from './supplier-payment-instructions.service';
import { RefundInstructionsService } from './refund-instructions.service';
import { CreateSupplierPaymentInstructionDto } from './dto/create-payment-instruction.dto';
import { CreateRefundInstructionDto } from './dto/create-refund-instruction.dto';
import { JwtAuthGuard } from '../../m1-core-identitet/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-supplier-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('finance')
export class SupplierPaymentsController {
  constructor(
    private readonly paymentInstructions: SupplierPaymentInstructionsService,
    private readonly refundInstructions: RefundInstructionsService,
  ) {}

  @Get('supplier-payment-instructions')
  @RequirePermission('M10', 'supplier-payment-instruction', 'VIEW')
  findAllInstructions(@Query('supplierObligationId') supplierObligationId: string | undefined) {
    return this.paymentInstructions.findAll({ supplierObligationId });
  }

  @Post('supplier-payment-instructions')
  @RequirePermission('M10', 'supplier-payment-instruction', 'VIEW')
  createInstruction(@Body() dto: CreateSupplierPaymentInstructionDto, @CurrentUser() actor: { userId: string }) {
    return this.paymentInstructions.create(dto, actor);
  }

  @Post('supplier-payment-instructions/:id/execute')
  @RequirePermission('M10', 'supplier-payment-instruction', 'EXECUTE')
  executeInstruction(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.paymentInstructions.execute(id, actor);
  }

  @Get('refund-instructions')
  @RequirePermission('M10', 'refund-instruction', 'VIEW')
  findAllRefunds(@Query('paymentId') paymentId: string | undefined) {
    return this.refundInstructions.findAll({ paymentId });
  }

  @Post('refund-instructions')
  @RequirePermission('M10', 'refund-instruction', 'VIEW')
  createRefund(@Body() dto: CreateRefundInstructionDto, @CurrentUser() actor: { userId: string }) {
    return this.refundInstructions.create(dto, actor);
  }

  @Post('refund-instructions/:id/approve')
  @RequirePermission('M10', 'refund-instruction', 'APPROVE')
  approveRefund(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.refundInstructions.approve(id, actor);
  }

  @Post('refund-instructions/:id/execute')
  @RequirePermission('M10', 'refund-instruction', 'EXECUTE')
  executeRefund(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.refundInstructions.execute(id, actor);
  }
}
