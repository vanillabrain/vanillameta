import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';


export class CreateWidgetViewDto {
    @IsNumber()
    @IsNotEmpty()
    databaseId: number;

    @IsString()
    @IsOptional()
    query: string;

}
