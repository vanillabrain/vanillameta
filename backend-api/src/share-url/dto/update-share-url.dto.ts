import { PartialType } from '@nestjs/swagger';
import { CreateShareUrlDto } from './create-share-url.dto';

export class UpdateShareUrlDto extends PartialType(CreateShareUrlDto) {}
