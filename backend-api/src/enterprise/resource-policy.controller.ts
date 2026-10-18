import { SourceLifecycleService } from './source-lifecycle.service';
import { SourceAccessService } from '../ownership/source-access.service';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EnterpriseResourcePolicyService } from './resource-policy.service';
@UseGuards(JwtAuthGuard)
@Controller('enterprise/resources')
export class EnterpriseResourceController {
  constructor(
    private readonly policy: EnterpriseResourcePolicyService,
    private readonly resourceAccess: SourceAccessService,
    private readonly lifecycle: SourceLifecycleService,
  ) {}
  private id(raw: string) {
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new BadRequestException('자원 번호를 확인해 주세요.');
    return Number(raw);
  }
  @Get() resources(@Req() req: any, @Query('after') after?: unknown) {
    return this.policy.resources(req.user.accessKeyData.id, after);
  }
  @Get(':kind/:id/policies') policies(
    @Req() req: any,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.policy.policies(this.policy.kind(kind), this.id(id), req.user.accessKeyData.id);
  }
  @Post(':kind/:id/policies') set(
    @Req() req: any,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.policy.set(this.policy.kind(kind), this.id(id), req.user.accessKeyData.id, body);
  }
  @Get(':kind/:id/group-policies') groupPolicies(
    @Req() req: any,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    return this.policy.groupPolicies(
      this.policy.kind(kind),
      this.id(id),
      req.user.accessKeyData.id,
    );
  }
  @Post(':kind/:id/group-policies') setGroupPolicy(
    @Req() req: any,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.policy.setGroupPolicy(
      this.policy.kind(kind),
      this.id(id),
      req.user.accessKeyData.id,
      body,
    );
  }
  @Get(':kind/:id/access') access(
    @Req() req: any,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    const resourceKind = this.policy.kind(kind);
    const resourceId = this.id(id),
      actor = req.user.accessKeyData.id;
    return resourceKind === 'source'
      ? this.resourceAccess.sourceCapabilities(resourceId, actor).then(rights => ({ rights }))
      : this.resourceAccess.dashboardCapabilities(resourceId, actor).then(rights => ({ rights }));
  }
  @Get('source/:id/lifecycle') lifecycleRead(@Req() req: any, @Param('id') id: string) {
    return this.lifecycle.read(this.id(id), req.user.accessKeyData.id);
  }
  @Post('source/:id/lifecycle') lifecycleSet(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.lifecycle.set(this.id(id), req.user.accessKeyData.id, body);
  }
}
