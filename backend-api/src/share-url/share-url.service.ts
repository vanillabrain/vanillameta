import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { User } from '../user/entities/user.entity';
import { Repository } from 'typeorm';
import { YesNo } from '../common/enum/yn.enum';
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

      const payload = {
        userId: findUser.userId,
        email: findUser.email,
        id: findUser.id,
      };
      const newToken = await this.authService.generateUrlAccessToken(payload); //새로운 공유 토큰 생성
      // N+1 쿼리 방지: relations를 사용하여 한 번에 조회
      const findDashboard = await this.dashboardRepository.findOne({
        where: { id: dashboardId },
        relations: ['dashboardShare'],
      });
      if (!findDashboard || !findDashboard.dashboardShare) {
        throw new HttpException('Dashboard or share not found', HttpStatus.NOT_FOUND);
      }
      const findDashboardShare = findDashboard.dashboardShare;
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
      // N+1 쿼리 방지: relations를 사용하여 한 번에 조회
      const findDashboard = await this.dashboardRepository.findOne({
        where: { id: dashboardId },
        relations: ['dashboardShare'],
      });
      if (!findDashboard || !findDashboard.dashboardShare) {
        throw new HttpException('Dashboard or share not found', HttpStatus.NOT_FOUND);
      }
      const findDashboardShare = findDashboard.dashboardShare;
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
      // N+1 쿼리 방지: 한 번의 쿼리로 dashboard와 share 정보를 함께 조회
      findDashboard = await this.dashboardRepository
        .createQueryBuilder('dashboard')
        .innerJoinAndSelect('dashboard.dashboardShare', 'dashboardShare')
        .where('dashboardShare.uuid = :uuid', { uuid })
        .getOne();

      if (!findDashboard) {
        throw new HttpException({ message: 'not exist share dashboard' }, HttpStatus.NOT_FOUND);
      }
      findDashboardShareUrl = findDashboard.dashboardShare;
    } catch (error) {
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
