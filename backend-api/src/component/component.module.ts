import { Module } from '@nestjs/common';
import { ComponentService } from './component.service';
import { ComponentController } from './component.controller';
import { TypeOrmModule } from "@nestjs/typeorm";
import { Component } from "./entities/component.entity";
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([Component])],
  controllers: [ComponentController],
  providers: [ComponentService, JwtService]
})
export class ComponentModule {}
