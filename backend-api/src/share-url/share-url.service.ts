import { serializedViewWrite } from '../dashboard/view-write-queue';
import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Dashboard } from '../dashboard/entities/dashboard.entity.js';
import { User } from '../user/entities/user.entity.js';
import { IsNull, Repository } from 'typeorm';
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

  private parseEndDate(value: string): Date {
    if (typeof value !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      throw new BadRequestException('invalid endDate (MM/DD/YYYY required)');
    }
    const [month, day, year] = value.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new BadRequestException('invalid endDate');
    }
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private assertActiveShare(share: DashboardShare | null): void {
    if (!share) throw new HttpException('not exist share dashboard', HttpStatus.NOT_FOUND);
    if (share.shareYn !== YesNo.YES)
      throw new HttpException('share disabled', HttpStatus.FORBIDDEN);
    const end = share.endDate ? new Date(share.endDate).getTime() : NaN;
    if (!Number.isFinite(end) || end <= Date.now()) {
      throw new HttpException('expired date', HttpStatus.UNAUTHORIZED);
    }
  }

  async checkShareUrlOn(userId: string, dashboardId: number, shareUrlOnDto: ShareUrlOnDto) {
    return serializedViewWrite(this.dashboardShareRepository, () =>
      this.shareOn(userId, dashboardId, shareUrlOnDto),
    );
  }
  private async shareOn(userId: string, dashboardId: number, shareUrlOnDto: ShareUrlOnDto) {
    const findUser = await this.userRepository.findOne({ where: { userId: userId } });
    if (!findUser) {
      return 'not exist user';
    } else {
      await this.dashboardService.assertOwner(dashboardId, findUser.id);
      const endDate = this.parseEndDate(shareUrlOnDto.endDate);
      const findDashboard = await this.dashboardRepository.findOne({ where: { id: dashboardId } });
      if (findDashboard?.governed)
        throw new HttpException(
          '조직 정책이 적용된 분석은 공개 공유할 수 없습니다.',
          HttpStatus.FORBIDDEN,
        );
      const findDashboardShare = await this.dashboardShareRepository.findOne({
        where: { id: findDashboard.shareId },
      });
      if (!findDashboardShare) {
        throw new HttpException('not exist share dashboard', HttpStatus.NOT_FOUND);
      }
      const newToken = await this.authService.generateUrlAccessToken({
        dashboardId,
        uuid: findDashboardShare.uuid,
      }); //새로운 공유 토큰 생성
      findDashboardShare.shareToken = newToken;
      findDashboardShare.shareYn = YesNo.YES;
      findDashboardShare.endDate = endDate;
      await this.dashboardShareRepository
        .createQueryBuilder()
        .update(DashboardShare)
        .set({
          shareToken: findDashboardShare.shareToken,
          shareYn: findDashboardShare.shareYn,
          endDate: findDashboardShare.endDate,
          reuseVersion: () => 'reuseVersion + 1',
        })
        .where('id = :id', { id: findDashboardShare.id })
        .execute();
      return { uuid: findDashboardShare.uuid, message: 'success' };
    }
  }
  // 공유기능 on시 공유토큰과 endDate를 저장

  async checkShareUrlOff(userId: string, dashboardId: number) {
    return serializedViewWrite(this.dashboardShareRepository, () =>
      this.shareOff(userId, dashboardId),
    );
  }
  private async shareOff(userId: string, dashboardId: number) {
    const findUser = await this.userRepository.findOne({ where: { userId: userId } });
    if (!findUser) {
      return 'not exist user';
    } else {
      await this.dashboardService.assertOwner(dashboardId, findUser.id);
      const findDashboard = await this.dashboardRepository.findOne({ where: { id: dashboardId } });
      const findDashboardShare = await this.dashboardShareRepository.findOne({
        where: { id: findDashboard.shareId },
      });
      if (!findDashboardShare) {
        throw new HttpException('not exist share dashboard', HttpStatus.NOT_FOUND);
      }
      findDashboardShare.shareToken = '';
      findDashboardShare.shareYn = YesNo.NO;
      findDashboardShare.endDate = null;
      await this.dashboardShareRepository
        .createQueryBuilder()
        .update(DashboardShare)
        .set({
          shareToken: findDashboardShare.shareToken,
          shareYn: findDashboardShare.shareYn,
          endDate: findDashboardShare.endDate,
          reuseVersion: () => 'reuseVersion + 1',
        })
        .where('id = :id', { id: findDashboardShare.id })
        .execute();
      return { message: 'success' };
    }
  }
  // 공유기능 off시 쉐어토큰, endDate을 없애고 사용가능여부를 N으로 저장

  async shareDashboardInfo(uuid: string) {
    let share = await this.dashboardShareRepository.findOne({ where: { uuid } });
    this.assertActiveShare(share);
    const dashboard = await this.dashboardRepository.findOne({ where: { shareId: share.id } });
    if (!dashboard || dashboard.delYn === YesNo.YES) {
      throw new HttpException({ message: 'not exist share dashboard' }, HttpStatus.NOT_FOUND);
    }
    const decoded = await this.authService.readUrlAccessToken(share.shareToken);
    if (
      decoded?.shareKeyData?.dashboardId !== dashboard.id ||
      decoded?.shareKeyData?.uuid !== uuid
    ) {
      const token = await this.authService.generateUrlAccessToken({
        dashboardId: dashboard.id,
        uuid,
      });
      const result = await this.dashboardShareRepository.update(
        { id: share.id, shareToken: share.shareToken ?? IsNull(), shareYn: YesNo.YES },
        { shareToken: token },
      );
      if (!result.affected) {
        share = await this.dashboardShareRepository.findOne({ where: { id: share.id } });
        this.assertActiveShare(share);
        const winning = await this.authService.readUrlAccessToken(share.shareToken);
        if (
          winning?.shareKeyData?.dashboardId !== dashboard.id ||
          winning?.shareKeyData?.uuid !== uuid
        ) {
          throw new HttpException('invalid share token', HttpStatus.UNAUTHORIZED);
        }
      }
    }
    return this.dashboardService.findShared(dashboard.id);
  }
  // 공유url로 접속시 대시보드의 정보를 받아오는 코드
}
