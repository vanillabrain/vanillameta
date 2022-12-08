import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateUserDto {

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    @IsNotEmpty()
    email: string;
}
