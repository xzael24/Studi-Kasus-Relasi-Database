import { PartialType } from '@nestjs/swagger';
import { CreatePublisherDto } from './create-publisher.dto.js';

export class UpdatePublisherDto extends PartialType(CreatePublisherDto) {}
