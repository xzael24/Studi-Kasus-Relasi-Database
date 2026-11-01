import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { Payment } from './entities/payment.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentDto } from './dto/update-payment.dto.js';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(): Promise<Payment[]> {
    return this.paymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Payment> {
    return this.paymentsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePaymentDto): Promise<Payment> {
    return this.paymentsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ): Promise<Payment> {
    return this.paymentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.paymentsService.remove(id);
  }
}
