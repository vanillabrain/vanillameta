import {OmitType } from '@nestjs/swagger';
import { CreateUserDto } from '../../user/dto/create-user.dto.js';

export class LoginUserDto extends OmitType(CreateUserDto, ['email'] as const) {}
