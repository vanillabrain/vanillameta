import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { ResponseStatus } from '../common/enum/response-status.enum';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog) private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(Dashboard) private readonly dashboardRepository: Repository<Dashboard>,
    @InjectRepository(Dataset) private readonly datasetRepository: Repository<Dataset>,
    @InjectRepository(Widget) private readonly widgetRepository: Repository<Widget>,
  ) {}

  /**
   * 전체 사용자 목록 조회 (비밀번호 제외)
   */
  async findAllUsers() {
    const users = await this.userRepository.find();
    users.forEach(user => delete user.password);
    return { status: ResponseStatus.SUCCESS, data: users };
  }

  /**
   * 사용자 역할 변경
   */
  async updateRole(id: number, role: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('not exist user');
    }
    user.role = role;
    await this.userRepository.save(user);
    delete user.password;
    return { status: ResponseStatus.SUCCESS, data: user };
  }

  /**
   * 감사 로그 조회 (최신순)
   */
  async findAuditLogs(limit = 100) {
    const logs = await this.auditLogRepository.find({
      order: { id: 'DESC' },
      take: limit,
    });
    return { status: ResponseStatus.SUCCESS, data: logs };
  }

  /**
   * 메타데이터 스냅샷 내보내기 (사용자/대시보드/데이터셋/위젯).
   * 비밀번호 등 민감정보는 제외한다.
   */
  async exportBackup() {
    const [users, dashboards, datasets, widgets] = await Promise.all([
      this.userRepository.find(),
      this.dashboardRepository.find(),
      this.datasetRepository.find(),
      this.widgetRepository.find(),
    ]);
    users.forEach(user => delete user.password);

    return {
      status: ResponseStatus.SUCCESS,
      data: {
        exportedAt: new Date().toISOString(),
        users,
        dashboards,
        datasets,
        widgets,
      },
    };
  }

  /**
   * 메타데이터 스냅샷 복구(비파괴적 upsert).
   * id 가 있으면 갱신, 없으면 삽입한다. 사용자(자격증명)는 복구하지 않는다.
   */
  async restoreBackup(snapshot: { dashboards?: any[]; datasets?: any[]; widgets?: any[] }) {
    const restored = { dashboards: 0, datasets: 0, widgets: 0 };

    const restore = async (items: any[] | undefined, repository: Repository<any>, key: keyof typeof restored) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        await repository.save(item);
        restored[key] += 1;
      }
    };

    await restore(snapshot?.dashboards, this.dashboardRepository, 'dashboards');
    await restore(snapshot?.datasets, this.datasetRepository, 'datasets');
    await restore(snapshot?.widgets, this.widgetRepository, 'widgets');

    return { status: ResponseStatus.SUCCESS, data: restored };
  }
}
