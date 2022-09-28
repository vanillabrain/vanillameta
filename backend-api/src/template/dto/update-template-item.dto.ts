import {PartialType} from '@nestjs/mapped-types';
import {CreateTemplateItemDto} from "./create-template-item.dto";

export class UpdateTemplateItemDto extends PartialType(CreateTemplateItemDto) {}
