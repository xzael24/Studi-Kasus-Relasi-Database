import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRegistrationDto {
  @ApiProperty({ example: 'ticket_001' })
  @IsNotEmpty()
  @IsUUID()
  ticketTypeId: string;
}
