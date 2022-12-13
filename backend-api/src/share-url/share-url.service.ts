import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { User } from '../user/entities/user.entity.js';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum.js';
import { ShareUrlOnDto } from './dto/create-share-url.dto';
import { UpdateShareUrlDto } from './dto/update-share-url.dto';
import { DashboardService } from '../dashboard/dashboard.service.js';
import { DashboardShare } from '../dashboard/entities/dashboard_share.js';

@Injectable()
export class ShareUrlService {
  constructor(
      @InjectRepository(User) private readonly userRepository: Repository<User>,
      @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
      @InjectRepository(DashboardShare) private dashboardShareRepository: Repository<DashboardShare>,
      private readonly authService: AuthService,
      private readonly dashboardService: DashboardService
  ) {
  }


  async checkShareUrlOn( userId:string, dashboardId: number, shareUrlOnDto: ShareUrlOnDto ) {
    const findUser = await this.userRepository.findOne({ where: { userId: userId }})
    if(!findUser){
      return 'not exist user'
    } else {
      const split = shareUrlOnDto.endDate.split('/')
      const dateForm = `${split[2]}-${split[0]}-${split[1]}`;
      const newToken = await this.authService.generateRefreshToken(String(dashboardId)); //새로운 공유 토큰 생성
      const findDashboard = await this.dashboardRepository.findOne( { where: { id: dashboardId } })
      const findDashboardShare = await this.dashboardShareRepository.findOne({ where: { id: findDashboard.shareId }})
      findDashboardShare.shareToken = newToken;
      findDashboardShare.shareYn = YesNo.YES;
      findDashboardShare.endDate = new Date(dateForm);
      await this.dashboardShareRepository.save(findDashboardShare)
      return { uuid: findDashboardShare.uuid, message: "success" }
    }
  }
  // 공유기능 on시 공유토큰과 endDate를 저장

  async checkShareUrlOff( userId:string, dashboardId: number, shareUrlOnDto: ShareUrlOnDto){
    const findUser = await this.userRepository.findOne({ where: { userId: userId }})
    if(!findUser){
      return 'not exist user'
    } else {
      const findDashboard = await this.dashboardRepository.findOne( { where: { id: dashboardId } })
      const findDashboardShare = await this.dashboardShareRepository.findOne({ where: { id: findDashboard.shareId }})
      findDashboardShare.shareToken = '';
      findDashboardShare.shareYn = YesNo.NO;
      findDashboardShare.endDate = null;
      await this.dashboardShareRepository.save(findDashboardShare)
      return { message: "success" }
    }
  }
  // 공유기능 off시 쉐어토큰, endDate을 없애고 사용가능여부를 N으로 저장

  async shareDashboardInfo(uuid: string){
    const findDashboardShareUrl = await this.dashboardShareRepository.findOne({ where: { uuid: uuid }})
    const findDashboard = await this.dashboardRepository.findOne({ where: { shareId: findDashboardShareUrl.id}})
    if(!findDashboard){
      return 'not exist share dashboard'
    }
    return this.dashboardService.findOne(+findDashboard.id)
  }
  // 공유url로 접속시 대시보드의 정보를 받아오는 코드
}
