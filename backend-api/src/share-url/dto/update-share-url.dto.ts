import { PartialType } from '@nestjs/swagger';
import { ShareUrlOnDto } from './create-share-url.dto';

export class UpdateShareUrlDto extends PartialType(ShareUrlOnDto) {}
