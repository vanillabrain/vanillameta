import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../user/entities/user.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Dashboard } from '../dashboard/entities/dashboard.entity';
import { Dataset } from '../dataset/entities/dataset.entity';
import { Widget } from '../widget/entities/widget.entity';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog, Dashboard, Dataset, Widget])],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard, JwtService],
})
export class AdminModule {}
