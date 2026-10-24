import { UserThrottle, UserThrottleGuard } from '../common/throttle/user-throttle.guard';
import {
  Body,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  NestInterceptor,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GovernanceService } from './governance.service';
@Injectable()
class NoStore implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context.switchToHttp().getResponse().setHeader('Cache-Control', 'no-store');
    return next.handle();
  }
}
@UseGuards(JwtAuthGuard, UserThrottleGuard)
@UseInterceptors(NoStore)
@Controller('bi/organizations')
export class GovernanceController {
  constructor(private readonly governance: GovernanceService) {}
  private actor(req: any) {
    return req.user?.accessKeyData?.id;
  }
  private success(data: unknown) {
    return { status: 'SUCCESS', data };
  }
  @Get() async list(@Req() req) {
    return this.success(await this.governance.organizations(this.actor(req)));
  }
  @Post() async create(@Body() body: any, @Req() req) {
    return this.success(await this.governance.createOrganization(body, this.actor(req)));
  }
  @Get(':orgId/admin') async admin(@Param('orgId') id: string, @Req() req) {
    return this.success(await this.governance.adminState(Number(id), this.actor(req)));
  }
  @Get(':orgId/views') async views(@Param('orgId') id: string, @Req() req) {
    return this.success(await this.governance.availableViews(Number(id), this.actor(req)));
  }
  @Get(':orgId/owned-dashboards') async owned(@Param('orgId') id: string, @Req() req) {
    return this.success(await this.governance.ownedDashboards(Number(id), this.actor(req)));
  }
  @Post(':orgId/policies/:policyId/revoke') async revoke(
    @Param('orgId') id: string,
    @Param('policyId') policyId: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(
      await this.governance.revokePolicy(Number(id), Number(policyId), body, this.actor(req)),
    );
  }
  @Post(':orgId/groups') async group(@Param('orgId') id: string, @Body() body: any, @Req() req) {
    return this.success(await this.governance.addGroup(Number(id), body, this.actor(req)));
  }
  @Post(':orgId/members') async member(@Param('orgId') id: string, @Body() body: any, @Req() req) {
    return this.success(await this.governance.setMember(Number(id), body, this.actor(req)));
  }
  @Get(':orgId/dashboards/:dashboardId/options') async options(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Req() req,
  ) {
    const { analysis, profile, blocks } = await this.governance.policyOptions(
      Number(id),
      Number(dashboard),
      this.actor(req),
    );
    return this.success({
      dashboardId: Number(dashboard),
      title: analysis.title,
      dashboardRevision: analysis.revision,
      sourceRevision: profile.dataVersion,
      columns: profile.columns.map(c => ({ name: c.name, type: c.type })),
      blocks: blocks.map(b => ({ id: b.id, title: b.title, supported: b.supported })),
    });
  }
  @Post(':orgId/dashboards/:dashboardId/policy') async policy(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(
      await this.governance.configurePolicy(Number(id), Number(dashboard), body, this.actor(req)),
    );
  }
  @Get(':orgId/dashboards/:dashboardId/view') async catalog(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Req() req,
  ) {
    return this.success(
      await this.governance.catalog(Number(id), Number(dashboard), this.actor(req)),
    );
  }
  @Post(':orgId/dashboards/:dashboardId/view/query') async query(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(
      await this.governance.query(Number(id), Number(dashboard), body, this.actor(req)),
    );
  }
  @Post(':orgId/dashboards/:dashboardId/view/rows') async rows(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(
      await this.governance.query(Number(id), Number(dashboard), body, this.actor(req), 'rows'),
    );
  }
  @Post(':orgId/dashboards/:dashboardId/view/values') async values(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(
      await this.governance.query(Number(id), Number(dashboard), body, this.actor(req), 'values'),
    );
  }
  @Post(':orgId/dashboards/:dashboardId/view/export') async exportCsv(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Body() body: any,
    @Req() req,
  ) {
    return this.success(
      await this.governance.exportCsv(Number(id), Number(dashboard), body, this.actor(req)),
    );
  }
  @UserThrottle('ai')
  @Post(':orgId/dashboards/:dashboardId/view/assistant')
  async assistant(
    @Param('orgId') id: string,
    @Param('dashboardId') dashboard: string,
    @Body() body: any,
    @Req() req,
    @Res({ passthrough: true }) res,
  ) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    const close = () => {
      if (!res.writableFinished) abort();
    };
    req.once('aborted', abort);
    res.once('close', close);
    if (req.aborted) abort();
    try {
      return this.success(
        await this.governance.assistant(
          Number(id),
          Number(dashboard),
          body,
          this.actor(req),
          controller.signal,
        ),
      );
    } finally {
      req.off('aborted', abort);
      res.off('close', close);
    }
  }
}
