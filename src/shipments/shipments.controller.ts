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
import { ShipmentsService } from './shipments.service.js';
import { Shipment } from './entities/shipment.entity.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { UpdateShipmentDto } from './dto/update-shipment.dto.js';

@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  findAll(): Promise<Shipment[]> {
    return this.shipmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Shipment> {
    return this.shipmentsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateShipmentDto): Promise<Shipment> {
    return this.shipmentsService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShipmentDto,
  ): Promise<Shipment> {
    return this.shipmentsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<{ message: string }> {
    return this.shipmentsService.remove(id);
  }
}
