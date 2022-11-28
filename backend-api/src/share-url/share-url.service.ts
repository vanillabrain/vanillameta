import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { UserInfo } from '../user/entities/user-info.entity.js';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum.js';
import { CreateShareUrlDto } from './dto/create-share-url.dto';
import { UpdateShareUrlDto } from './dto/update-share-url.dto';

@Injectable()
export class ShareUrlService {
  constructor(
      @InjectRepository(UserInfo) private readonly userInfoRepository: Repository<UserInfo>,
      @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
      private readonly authService: AuthService,
  ) {
  }


  async checkShareUrlOn( accessToken:string, dashboard_id: number, user_id: string ) {
    const findpass = await this.userInfoRepository.findOne({ where: { user_id: user_id }})
    const findUser = await this.authService.checkAccess(accessToken, findpass.password);
    if(!findUser){
      return 'not exist user'
    } else {
      const newToken = await this.authService.generateRefreshToken(String(dashboard_id)); //새로운 공유 토큰 생성
      const findDashboard = await this.dashboardRepository.findOne( { where: { id: dashboard_id } })
      findDashboard.shareToken = newToken;
      findDashboard.shareYn = YesNo.YES;
      await this.dashboardRepository.save(findDashboard)
      return { Token: findDashboard.shareToken, message: "success" }
    }
  }

  async checkShareUrlOff( accessToken:string, dashboard_id: number, user_id: string ){
    const findpass = await this.userInfoRepository.findOne({ where: { user_id: user_id }})
    const findUser = await this.authService.checkAccess(accessToken, findpass.password);
    if(!findUser){
      return 'not exist user'
    } else {
      const findDashboard = await this.dashboardRepository.findOne( { where: { id: dashboard_id } })
      findDashboard.shareToken = null;
      findDashboard.shareYn = YesNo.NO;
      await this.dashboardRepository.save(findDashboard)
      return { message: "success" }
    }
  }

  async shareDashboardInfo(token: string){
    const findDashboard = await this.dashboardRepository.findOne({ where: { shareToken: token }})
    if(!findDashboard){
      return 'not exist share dashboard'
    }
    findDashboard.layout = JSON.parse(findDashboard.layout)
    return findDashboard;
  }
}
