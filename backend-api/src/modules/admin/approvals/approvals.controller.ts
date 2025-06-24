import { 
  Controller, 
  Get, 
  Post, 
  Param, 
  Body, 
  Query, 
  UseGuards,
  Request
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth 
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../guards/permission.guard';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { ApprovalsService } from './approvals.service';
import { 
  GetPendingApprovalsQueryDto, 
  ApprovalStatsDto,
  BulkApprovalResultDto,
  UserApprovalDto,
  UserApprovalDetailDto
} from './dto/approval-query.dto';
import { ApproveUserDto } from './dto/approve-user.dto';
import { RejectUserDto } from './dto/reject-user.dto';
import { BulkApproveDto } from './dto/bulk-approve.dto';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto';

@ApiTags('Admin - Approvals')
@Controller('admin/approvals')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth()
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  @RequirePermissions('admin.users.approve')
  @ApiOperation({ summary: '승인 대기 중인 사용자 목록 조회' })
  @ApiResponse({ status: 200, description: '승인 대기 목록' })
  async getPendingApprovals(
    @Query() query: GetPendingApprovalsQueryDto,
  ): Promise<PaginatedResponseDto<UserApprovalDto>> {
    return this.approvalsService.getPendingApprovals(query);
  }

  @Get('stats')
  @RequirePermissions('admin.users.approve')
  @ApiOperation({ summary: '승인 통계 조회' })
  @ApiResponse({ status: 200, description: '승인 통계' })
  async getApprovalStats(): Promise<ApprovalStatsDto> {
    return this.approvalsService.getApprovalStats();
  }

  @Get(':id')
  @RequirePermissions('admin.users.approve')
  @ApiOperation({ summary: '승인 요청 상세 조회' })
  @ApiResponse({ status: 200, description: '승인 요청 상세 정보' })
  async getApprovalDetail(@Param('id') id: string): Promise<UserApprovalDetailDto> {
    return this.approvalsService.getApprovalDetail(id);
  }

  @Post(':id/approve')
  @RequirePermissions('admin.users.approve')
  @ApiOperation({ summary: '사용자 승인' })
  @ApiResponse({ status: 200, description: '승인 완료' })
  async approveUser(
    @Param('id') id: string,
    @Body() approveDto: ApproveUserDto,
    @Request() req,
  ): Promise<void> {
    return this.approvalsService.approveUser(id, approveDto, req.user);
  }

  @Post(':id/reject')
  @RequirePermissions('admin.users.approve')
  @ApiOperation({ summary: '사용자 승인 거부' })
  @ApiResponse({ status: 200, description: '승인 거부 완료' })
  async rejectUser(
    @Param('id') id: string,
    @Body() rejectDto: RejectUserDto,
    @Request() req,
  ): Promise<void> {
    return this.approvalsService.rejectUser(id, rejectDto, req.user);
  }

  @Post('bulk-approve')
  @RequirePermissions('admin.users.approve')
  @ApiOperation({ summary: '사용자 일괄 승인' })
  @ApiResponse({ status: 200, description: '일괄 승인 결과' })
  async bulkApprove(
    @Body() bulkApproveDto: BulkApproveDto,
    @Request() req,
  ): Promise<BulkApprovalResultDto> {
    return this.approvalsService.bulkApprove(bulkApproveDto, req.user);
  }
}