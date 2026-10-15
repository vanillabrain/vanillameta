import { HttpException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardReuseService } from './dashboard-reuse.service';
import { SharedReuseOriginService } from './shared-reuse-origin.service';
@UseGuards(JwtAuthGuard)
@Controller('bi/reuse/:kind/:uuid')
export class SharedReuseController {
  constructor(private readonly reuse: DashboardReuseService) {}
  @Get() async draft(@Param() p: any, @Req() r: any) {
    return {
      status: 'SUCCESS',
      data: await safeOrigin(() => this.reuse.draft(p.uuid, r.user?.accessKeyData?.id, p.kind)),
    };
  }
  @Post('preview') async preview(@Param() p: any, @Req() r: any, @Body() body: any) {
    try {
      return {
        status: 'SUCCESS',
        data: await this.reuse.preview(p.uuid, body, r.user?.accessKeyData?.id, p.kind),
      };
    } catch (error) {
      throw new HttpException(
        '링크 권한·버전과 내 소스의 열 연결을 확인한 뒤 다시 미리보기해 주세요.',
        error instanceof HttpException ? error.getStatus() : 400,
      );
    }
  }
  @Post() async save(@Param() p: any, @Req() r: any, @Body() body: any) {
    return {
      status: 'SUCCESS',
      data: await safeOrigin(() =>
        this.reuse.save(p.uuid, body, r.user?.accessKeyData?.id, p.kind),
      ),
    };
  }
}
@Controller('reuse-links/:kind/:uuid')
export class ReuseLinkController {
  constructor(private readonly origins: SharedReuseOriginService) {}
  @Get() async status(@Param() p: any) {
    return { status: 'SUCCESS', data: await this.origins.status(p.kind, p.uuid) };
  }
}
@UseGuards(JwtAuthGuard)
@Controller('bi/dashboards/:id/reuse-access')
export class ReuseAccessController {
  constructor(private readonly origins: SharedReuseOriginService) {}
  @Get() async state(@Param('id') id: string, @Req() r: any) {
    return { status: 'SUCCESS', data: await this.origins.grant(id, r.user?.accessKeyData?.id) };
  }
  @Post() async grant(@Param('id') id: string, @Req() r: any, @Body() body: any) {
    return {
      status: 'SUCCESS',
      data: await this.origins.grant(id, r.user?.accessKeyData?.id, body),
    };
  }
}

// Stored formulas can contain private literals; diagnostics cannot cross the link boundary.
async function safeOrigin<T>(run: () => Promise<T>) {
  try {
    return await run();
  } catch (error) {
    throw new HttpException(
      '링크 권한·버전과 내 소스를 확인해 주세요. 입력은 유지됩니다.',
      error instanceof HttpException ? error.getStatus() : 400,
    );
  }
}
