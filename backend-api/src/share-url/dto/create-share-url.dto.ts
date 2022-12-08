import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
export class ShareUrlOnDto {
    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    endDate: string;
}


