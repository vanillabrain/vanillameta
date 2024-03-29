import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { User } from '../user/entities/user.entity.js';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum.js';
import { ShareUrlOnDto } from './dto/create-share-url.dto';
import { DashboardService } from '../dashboard/dashboard.service';
import { DashboardShare } from 'src/dashboard/entities/dashboard_share.entity';

@Injectable()
export class ShareUrlService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(Dashboard) private dashboardRepository: Repository<Dashboard>,
    @InjectRepository(DashboardShare) private dashboardShareRepository: Repository<DashboardShare>,
    private readonly authService: AuthService,
    private readonly dashboardService: DashboardService,
  ) {}

  async checkShareUrlOn(userId: string, dashboardId: number, shareUrlOnDto: ShareUrlOnDto) {
    const findUser = await this.userRepository.findOne({ where: { userId: userId } });
    if (!findUser) {
      return 'not exist user';
    } else {
      const split = shareUrlOnDto.endDate.split('/');
      const dateForm = `${split[2]}-${split[0]}-${split[1]}`;

      const newToken = await this.authService.generateUrlAccessToken(String(dashboardId)); //새로운 공유 토큰 생성
      const findDashboard = await this.dashboardRepository.findOne({ where: { id: dashboardId } });
      const findDashboardShare = await this.dashboardShareRepository.findOne({
        where: { id: findDashboard.shareId },
      });
      findDashboardShare.shareToken = newToken;
      findDashboardShare.shareYn = YesNo.YES;
      findDashboardShare.endDate = new Date(dateForm);
      await this.dashboardShareRepository.save(findDashboardShare);
      return { uuid: findDashboardShare.uuid, message: 'success' };
    }
  }
  // 공유기능 on시 공유토큰과 endDate를 저장

  async checkShareUrlOff(userId: string, dashboardId: number) {
    const findUser = await this.userRepository.findOne({ where: { userId: userId } });
    if (!findUser) {
      return 'not exist user';
    } else {
      const findDashboard = await this.dashboardRepository.findOne({ where: { id: dashboardId } });
      const findDashboardShare = await this.dashboardShareRepository.findOne({
        where: { id: findDashboard.shareId },
      });
      findDashboardShare.shareToken = '';
      findDashboardShare.shareYn = YesNo.NO;
      findDashboardShare.endDate = null;
      await this.dashboardShareRepository.save(findDashboardShare);
      return { message: 'success' };
    }
  }
  // 공유기능 off시 쉐어토큰, endDate을 없애고 사용가능여부를 N으로 저장

  async shareDashboardInfo(uuid: string) {
    let findDashboard = null;
    let findDashboardShareUrl = null;
    try {
      findDashboardShareUrl = await this.dashboardShareRepository.findOne({
        where: { uuid: uuid },
      });
      findDashboard = await this.dashboardRepository.findOne({
        where: { shareId: findDashboardShareUrl.id },
      });
    } catch {
      throw new HttpException({ message: 'not exist share dashboard' }, HttpStatus.NOT_FOUND);
    }
    const today = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${
      new Date().getDate() - 1
    }`;
    if (new Date(today) > findDashboardShareUrl.endDate) {
      throw new HttpException({ message: 'expired date' }, HttpStatus.UNAUTHORIZED);
    }
    return this.dashboardService.findOne(+findDashboard.id);
  }
  // 공유url로 접속시 대시보드의 정보를 받아오는 코드
}
