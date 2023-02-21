import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

@ApiTags('유저생성 Dto')
export class CreateUserDto {

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: '유저Id'})
    userId: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: '유저password'})
    password: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: '유저email'})
    email: string;
}
