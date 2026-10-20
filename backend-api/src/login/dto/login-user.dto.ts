import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUserDto } from '../../user/dto/create-user.dto.js';

export class LoginUserDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'user@example.com',
  })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: '사용자 비밀번호',
    example: 'password123',
  })
  password: string;
}
