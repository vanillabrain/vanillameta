import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiArtifactActor, AiArtifactsService } from './ai-artifacts.service';

type AiArtifactRequest = { user: { accessKeyData: { id: number } } };

function actorOf(request: AiArtifactRequest): AiArtifactActor {
  return { actorId: request.user.accessKeyData.id };
}

@UseGuards(JwtAuthGuard)
@Controller('ai-artifacts')
export class AiArtifactsController {
  constructor(private readonly artifacts: AiArtifactsService) {}

  @Get()
  list(@Req() req: AiArtifactRequest) {
    return this.artifacts.list(actorOf(req));
  }

  @Get(':id')
  get(@Req() req: AiArtifactRequest, @Param('id') id: string) {
    return this.artifacts.get(actorOf(req), id);
  }
}
