import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ description: '본인 확인용 비밀번호' })
  password: string;
}
