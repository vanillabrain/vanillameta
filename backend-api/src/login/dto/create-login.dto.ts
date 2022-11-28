import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateLoginDto {

    @IsString()
    @IsNotEmpty()
    user_id: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    @IsNotEmpty()
    email: string;
}
