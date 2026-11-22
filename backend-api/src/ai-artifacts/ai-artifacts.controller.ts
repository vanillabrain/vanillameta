import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  ParseIntPipe,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiArtifactActor, AiArtifactsService } from './ai-artifacts.service';

import { AiArtifactSharingService } from './ai-artifact-sharing.service';

type AiArtifactRequest = { user: { accessKeyData: { id: number } } };

function actorOf(request: AiArtifactRequest): AiArtifactActor {
  return { actorId: request.user.accessKeyData.id };
}

@UseGuards(JwtAuthGuard)
@Controller('ai-artifacts')
export class AiArtifactsController {
  constructor(
    private readonly artifacts: AiArtifactsService,
    private readonly sharing: AiArtifactSharingService,
  ) {}

  @Get()
  list(@Req() req: AiArtifactRequest) {
    return this.artifacts.list(actorOf(req));
  }

  @Get('received')
  received(@Req() req: AiArtifactRequest) {
    return this.sharing.list(actorOf(req).actorId);
  }

  @Get(':id/revisions')
  history(@Req() req: AiArtifactRequest, @Param('id') id: string) {
    return this.artifacts.revisions(actorOf(req), id);
  }

  @Get(':id/revisions/:revision')
  version(
    @Req() req: AiArtifactRequest,
    @Param('id') id: string,
    @Param('revision', ParseIntPipe) revision: number,
  ) {
    return this.artifacts.revision(actorOf(req), id, revision);
  }

  @Post(':id/revisions/:revision/restore')
  restore(
    @Req() req: AiArtifactRequest,
    @Param('id') id: string,
    @Param('revision', ParseIntPipe) revision: number,
    @Body() body: unknown,
  ) {
    return this.artifacts.restore(actorOf(req), id, revision, body);
  }

  @Get(':id/shares')
  recipients(@Req() req: AiArtifactRequest, @Param('id') id: string) {
    return this.sharing.recipients(actorOf(req).actorId, id);
  }

  @Post(':id/share')
  share(@Req() req: AiArtifactRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.sharing.set(actorOf(req).actorId, id, body);
  }

  @Get(':id')
  async get(@Req() req: AiArtifactRequest, @Param('id') id: string) {
    const actor = actorOf(req);
    try {
      return { ...(await this.artifacts.get(actor, id)), role: 'owner' };
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      return this.sharing.read(actor.actorId, id);
    }
  }
}
