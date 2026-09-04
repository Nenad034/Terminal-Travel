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
import { AgentActionGuard } from '../../../common/guards/agent-action.guard';
import { AgentAction } from '../../../common/decorators/agent-action.decorator';

// M10 spec §10, prefiks /api/v1/finance
@ApiTags('finance-supplier-payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard, AgentActionGuard)
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

  // Dopuna 4.9.2026 (nalaz pri pisanju API dokumentacije, M10 spec §11): sastavljanje
  // naloga je do sada tražilo istu dozvolu kao puki uvid — ko sme da GLEDA obaveze, smeo je
  // i da SASTAVI nalog za isplatu. Sam prenos novca jeste bio zaštićen odvojenom EXECUTE
  // dozvolom (pa novac nije mogao izaći), ali podela "ko sastavlja ≠ ko izvršava" nije bila
  // potpuna dok kreiranje nije tražilo sopstveno pravo.
  @Post('supplier-payment-instructions')
  @RequirePermission('M10', 'supplier-payment-instruction', 'CREATE')
  createInstruction(@Body() dto: CreateSupplierPaymentInstructionDto, @CurrentUser() actor: { userId: string }) {
    return this.paymentInstructions.create(dto, actor);
  }

  @Post('supplier-payment-instructions/:id/execute')
  @RequirePermission('M10', 'supplier-payment-instruction', 'EXECUTE')
  @AgentAction(null, 'money.transfer')
  executeInstruction(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.paymentInstructions.execute(id, actor);
  }

  @Get('refund-instructions')
  @RequirePermission('M10', 'refund-instruction', 'VIEW')
  findAllRefunds(@Query('paymentId') paymentId: string | undefined) {
    return this.refundInstructions.findAll({ paymentId });
  }

  @Post('refund-instructions')
  @RequirePermission('M10', 'refund-instruction', 'CREATE')
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
  @AgentAction(null, 'money.transfer')
  executeRefund(@Param('id') id: string, @CurrentUser() actor: { userId: string }) {
    return this.refundInstructions.execute(id, actor);
  }
}
