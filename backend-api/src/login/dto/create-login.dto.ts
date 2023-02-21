import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

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
}
