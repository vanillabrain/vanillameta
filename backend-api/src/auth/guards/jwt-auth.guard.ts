import { serializeMetadataWork } from '../../common/metadata-work';
import { ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { DataSource, In } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { DashboardShare } from '../../dashboard/entities/dashboard_share.entity';
import { Dashboard } from '../../dashboard/entities/dashboard.entity';
import { DashboardWidget } from '../../dashboard/dashboard-widget/entities/dashboard-widget.entity';
import { Widget } from '../../widget/entities/widget.entity';
import { YesNo } from '../../common/enum/yn.enum';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private jwtService: JwtService, private readonly dataSource: DataSource) {
    super();
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    return serializeMetadataWork(this.dataSource, async () => {
      const request = context.switchToHttp().getRequest();
      const { authorization } = request.headers;
      const urlAuth = request.headers['authorization-url'];
      if (authorization === undefined && urlAuth === undefined) {
        throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
      }
      if (authorization !== undefined) {
        if (typeof authorization !== 'string') {
          throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
        }
        const token = authorization.replace('Bearer ', ''); //authorization
        const boolean = true; // 일반 대시보드일시
        const userInfo = await this.validate(token, boolean);
        if (userInfo) request.user = userInfo;
        return !!userInfo;
      } else if (urlAuth !== undefined) {
        if (typeof urlAuth !== 'string') {
          throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
        }
        const token = urlAuth.replace('Bearer ', ''); //authorization-url
        const boolean = false; // 공유대시보드일시
        const userInfo = await this.validate(token, boolean);
        const pathname = request.path ?? request.url?.split('?')[0];
        if (
          request.method !== 'GET' ||
          !['/v1/database/data', '/database/data'].includes(pathname)
        ) {
          throw new HttpException('share access denied', HttpStatus.FORBIDDEN);
        }
        const datasetType = request.query?.datasetType;
        const rawId = request.query?.datasetId;
        const datasetId =
          typeof rawId === 'string' || typeof rawId === 'number' ? Number(rawId) : NaN;
        if (typeof datasetType !== 'string' || !Number.isInteger(datasetId) || datasetId <= 0) {
          throw new HttpException('share access denied', HttpStatus.FORBIDDEN);
        }
        const mappings = await this.dataSource.getRepository(DashboardWidget).find({
          where: { dashboardId: userInfo.shareKeyData.dashboardId },
        });
        const widgetIds = mappings.map(mapping => mapping.widgetId);
        const widgets = widgetIds.length
          ? await this.dataSource.getRepository(Widget).find({ where: { id: In(widgetIds) } })
          : [];
        if (
          !widgets.some(
            widget => widget.datasetType === datasetType && widget.datasetId === datasetId,
          )
        ) {
          throw new HttpException('share access denied', HttpStatus.FORBIDDEN);
        }
        if (userInfo) request.user = userInfo;
        return !!userInfo;
      }
    });
  }

  async validate(payload: any, accessPath: boolean) {
    return serializeMetadataWork(this.dataSource, async () => {
      if (accessPath === true) {
        try {
          const secretKey = process.env.ACCESS_SECRET;
          const verify = await this.jwtService.verify(payload, {
            secret: secretKey,
          });
          const actor = verify?.accessKeyData;
          if (
            !Number.isInteger(actor?.id) ||
            actor.id <= 0 ||
            typeof actor.userId !== 'string' ||
            !actor.userId
          ) {
            throw new Error('invalid actor');
          }
          const user = await this.dataSource.getRepository(User).findOne({
            where: { id: actor.id, userId: actor.userId },
          });
          if (
            !user ||
            user.active === false ||
            !Number.isSafeInteger(actor.authVersion ?? 0) ||
            (actor.authVersion ?? 0) !== (user.authVersion ?? 0)
          )
            throw new Error('revoked actor');
          return verify;
        } catch {
          throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
        }
      }
      if (accessPath === false) {
        try {
          const secretUrlKey = process.env.URL_ACCESS_SECRET || process.env.ACCESS_SECRET;
          const verifyUrl = await this.jwtService.verify(payload, {
            secret: secretUrlKey,
          });
          const scope = verifyUrl?.shareKeyData;
          if (
            !Number.isInteger(scope?.dashboardId) ||
            scope.dashboardId <= 0 ||
            typeof scope.uuid !== 'string' ||
            !scope.uuid
          ) {
            throw new Error('invalid share scope');
          }
          const share = await this.dataSource.getRepository(DashboardShare).findOne({
            where: { uuid: scope.uuid, shareToken: payload, shareYn: YesNo.YES },
          });
          const end = share?.endDate ? new Date(share.endDate).getTime() : NaN;
          if (!share || share.shareYn !== YesNo.YES || !Number.isFinite(end) || end <= Date.now()) {
            throw new Error('inactive share');
          }
          const dashboard = await this.dataSource.getRepository(Dashboard).findOne({
            where: { id: scope.dashboardId, shareId: share.id },
          });
          if (!dashboard || dashboard.delYn === YesNo.YES || dashboard.assetActive === false)
            throw new Error('missing share dashboard');
          return verifyUrl;
        } catch {
          throw new HttpException('accessTokenExpired', HttpStatus.UNAUTHORIZED);
        }
      }
    });
  }
}
