import {IsNumber, IsString} from "class-validator";

export class CreateDatasetDto {
    @IsString()
    title: string;

    @IsNumber()
    databaseId: number;

    @IsString()
    query:string;
    // readonly setting before
}
