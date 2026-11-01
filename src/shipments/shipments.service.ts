import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment } from './entities/shipment.entity.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { UpdateShipmentDto } from './dto/update-shipment.dto.js';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
  ) {}

  findAll(): Promise<Shipment[]> {
    return this.shipmentRepository.find({ relations: { order: true } });
  }

  async findOne(id: string): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findOne({
      where: { id },
      relations: { order: true },
    });
    if (!shipment) {
      throw new NotFoundException(`Shipment dengan ID ${id} tidak ditemukan`);
    }
    return shipment;
  }

  create(dto: CreateShipmentDto): Promise<Shipment> {
    const shipment = this.shipmentRepository.create({
      ...dto,
      shippedAt: dto.shippedAt ? new Date(dto.shippedAt) : null,
      deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : null,
    });
    return this.shipmentRepository.save(shipment);
  }

  async update(id: string, dto: UpdateShipmentDto): Promise<Shipment> {
    await this.findOne(id);
    await this.shipmentRepository.update(id, {
      ...dto,
      ...(dto.shippedAt ? { shippedAt: new Date(dto.shippedAt) } : {}),
      ...(dto.deliveredAt ? { deliveredAt: new Date(dto.deliveredAt) } : {}),
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    const shipment = await this.findOne(id);
    await this.shipmentRepository.remove(shipment);
    return { message: `Shipment dengan ID ${id} berhasil dihapus` };
  }
}
