import { PartialType } from '@nestjs/swagger';
import { CreateShipmentDto } from './create-shipment.dto.js';

export class UpdateShipmentDto extends PartialType(CreateShipmentDto) {}
