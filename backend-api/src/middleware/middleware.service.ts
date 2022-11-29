import { Injectable } from '@nestjs/common';
import { CreateMiddlewareDto } from './dto/create-middleware.dto';
import { UpdateMiddlewareDto } from './dto/update-middleware.dto';

@Injectable()
export class MiddlewareService {
  create(createMiddlewareDto: CreateMiddlewareDto) {
    return 'This action adds a new middleware';
  }

  findAll() {
    return `This action returns all middleware`;
  }

  findOne(id: number) {
    return `This action returns a #${id} middleware`;
  }

  update(id: number, updateMiddlewareDto: UpdateMiddlewareDto) {
    return `This action updates a #${id} middleware`;
  }

  remove(id: number) {
    return `This action removes a #${id} middleware`;
  }
}
