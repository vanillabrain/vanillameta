import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
export class ShareUrlOnDto {
    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: '유저Id'})
    userId: string;

    @IsString()
    @IsNotEmpty()
    @ApiProperty({ description: '공유 url 공유기간'})
    endDate: string;
}


