import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentDto } from './dto/update-payment.dto.js';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  findAll(): Promise<Payment[]> {
    return this.paymentRepository.find({ relations: { order: true } });
  }

  async findOne(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: { order: true },
    });
    if (!payment) {
      throw new NotFoundException(`Payment dengan ID ${id} tidak ditemukan`);
    }
    return payment;
  }

  create(dto: CreatePaymentDto): Promise<Payment> {
    const payment = this.paymentRepository.create({
      ...dto,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : null,
    });
    return this.paymentRepository.save(payment);
  }

  async update(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    await this.findOne(id);
    await this.paymentRepository.update(id, {
      ...dto,
      ...(dto.paidAt ? { paidAt: new Date(dto.paidAt) } : {}),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const payment = await this.findOne(id);
    await this.paymentRepository.remove(payment);
    return { message: `Payment dengan ID ${id} berhasil dihapus` };
  }
}
