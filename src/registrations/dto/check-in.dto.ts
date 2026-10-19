import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckInDto {
  @ApiProperty({ example: 'reg_001' })
  @IsNotEmpty()
  @IsUUID()
  registrationId: string;
}
