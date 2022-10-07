import { Injectable } from '@nestjs/common';
import { CreateDashboardDto } from './dto/create-dashboard.dto';
import { UpdateDashboardDto } from './dto/update-dashboard.dto';
import { InjectRepository } from "@nestjs/typeorm";
import { Component } from "../component/entities/component.entity";
import { Repository } from "typeorm";
import { Dashboard } from "./entities/dashboard.entity"

@Injectable()
export class DashboardService {
  constructor(
      @InjectRepository(Dashboard)
      private dashboardRepository: Repository<Dashboard>) {}

  create(createDashboardDto: CreateDashboardDto) {
    return 'This action adds a new dashboard';
  }

  async findAll() {
    const find_all = await this.dashboardRepository.find();
    return find_all
  }

  findOne(id: number) {
    return `This action returns a #${id} dashboard`;
  }

  update(id: number, updateDashboardDto: UpdateDashboardDto) {
    return `This action updates a #${id} dashboard`;
  }

  remove(id: number) {
    return `This action removes a #${id} dashboard`;
  }
}
