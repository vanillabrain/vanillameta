import {IsNumber, IsString} from "class-validator";

export class CreateDatasetDto {
    @IsString()
    readonly title: string;

    @IsNumber()
    readonly databaseId: number;

    @IsString()
    readonly query:string;

}
