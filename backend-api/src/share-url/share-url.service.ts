import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { User } from '../user/entities/user.entity.js';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum.js';
import { CreateShareUrlDto } from './dto/create-share-url.dto';
import { UpdateShareUrlDto } from './dto/update-share-url.dto';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { DashboardShare } from '../dashboard/entities/dashboard_share.js';

@Injectable()
export class ShareUrlService {
  constructor(
      @InjectRepository(User) private readonly userRepository: Repository<User>,
      @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
      @InjectRepository(DashboardShare) private dashbaordShareRepository: Repository<DashboardShare>,
      private readonly authService: AuthService,
      private readonly dashboardService: DashboardService
  ) {
  }


  async checkShareUrlOn( accessToken:string, dashboard_id: number, user_id: string ) {
    const findpass = await this.userRepository.findOne({ where: { user_id: user_id }})
    const findUser = await this.authService.checkAccess(accessToken, findpass.password);
    if(!findUser){
      return 'not exist user'
    } else {
      const newToken = await this.authService.generateRefreshToken(String(dashboard_id)); //새로운 공유 토큰 생성
      const findDashboardSahre = await this.dashbaordShareRepository.findOne( { where: { id: dashboard_id } })
      findDashboardSahre.share_token = newToken;
      findDashboardSahre.share_yn = YesNo.YES;
      await this.dashbaordShareRepository.save(findDashboardSahre)
      return { Token: findDashboardSahre.share_token, message: "success" }
    }
  }

  async checkShareUrlOff( accessToken:string, dashboard_id: number, user_id: string ){
    const findpass = await this.userRepository.findOne({ where: { user_id: user_id }})
    const findUser = await this.authService.checkAccess(accessToken, findpass.password);
    if(!findUser){
      return 'not exist user'
    } else {
      const findDashboard = await this.dashbaordShareRepository.findOne( { where: { id: dashboard_id } })
      findDashboard.share_token = null;
      findDashboard.share_yn = YesNo.NO;
      await this.dashbaordShareRepository.save(findDashboard)
      return { message: "success" }
    }
  }

  async shareDashboardInfo(token: string){
    const findDashboard = await this.dashbaordShareRepository.findOne({ where: { share_token: token }})
    if(!findDashboard){
      return 'not exist share dashboard'
    }
    return this.dashboardService.findOne(+findDashboard.id)
  }
}
