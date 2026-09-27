import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enum/role.enum';
import { AdminService } from './admin.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RestoreBackupDto } from './dto/restore-backup.dto';

@ApiTags('admin')
@ApiBearerAuth('AccessKey')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: '전체 사용자 목록 (관리자)' })
  findAllUsers() {
    return this.adminService.findAllUsers();
  }

  @Patch('users/:id/role')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: '사용자 역할 변경 (관리자)' })
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.adminService.updateRole(+id, updateRoleDto.role);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '감사 로그 조회 (관리자)' })
  findAuditLogs() {
    return this.adminService.findAuditLogs();
  }

  @Get('backup')
  @ApiOperation({ summary: '메타데이터 백업 스냅샷 내보내기 (관리자)' })
  exportBackup() {
    return this.adminService.exportBackup();
  }

  @Post('backup/restore')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: '메타데이터 스냅샷 복구 (관리자, upsert)' })
  restoreBackup(@Body() restoreBackupDto: RestoreBackupDto) {
    return this.adminService.restoreBackup(restoreBackupDto);
  }
}
