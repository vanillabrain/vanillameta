import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StaffDepartureImpactService } from './staff-departure-impact.service';

@Controller('enterprise/members')
@UseGuards(JwtAuthGuard)
export class StaffDepartureImpactController {
  constructor(private readonly service: StaffDepartureImpactService) {}

  @Get(':id/departure-impact')
  inspect(@Req() request: any, @Param('id') id: string) {
    const actor = request.user.accessKeyData;
    return this.service.inspect(actor.id, actor.authVersion ?? 0, id);
  }
}
