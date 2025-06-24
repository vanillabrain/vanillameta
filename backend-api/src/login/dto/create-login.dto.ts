import { IsNotEmpty, IsNumber, IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLoginDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: '사용자 ID (고유 식별자)',
    example: 'johndoe',
    minLength: 3,
    maxLength: 50,
  })
  userId: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({
    description: '사용자 비밀번호',
    example: 'StrongPassword123!',
    minLength: 8,
  })
  password: string;

  @IsEmail()
  @IsNotEmpty()
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'johndoe@example.com',
    format: 'email',
  })
  email: string;

  @IsString()
  @IsOptional()
  @ApiProperty({
    description: '가입 신청 메모 (선택사항)',
    example: '데이터 분석팀에서 VanillaMeta를 사용하고자 합니다.',
    required: false,
  })
  applicationNote?: string;
}
