import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLoginDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  /** Required while SIGNUP_MODE=invite (the production default). */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  inviteCode?: string;
}
