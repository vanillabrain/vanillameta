import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User, UserStatus } from 'src/user/entities/user.entity';
import { UserApproval, ApprovalStatus } from 'src/modules/admin/entities/user-approval.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshToken } from 'src/auth/entities/refresh_token.entity';
import { EmailService } from 'src/common/services/email.service';
import { NotificationService } from 'src/common/services/notification.service';
import { AuditLogService } from 'src/modules/admin/audit-log.service';
import { AuditLogCategory } from 'src/modules/admin/entities/audit-log.entity';
import { AUDIT_ACTIONS } from 'src/modules/admin/dto/audit-log.dto';
import * as crypto from 'crypto';

@Injectable()
export class LoginService {
  constructor(
    private authService: AuthService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshRepository: Repository<RefreshToken>,
    @InjectRepository(UserApproval) private readonly approvalRepository: Repository<UserApproval>,
    private emailService: EmailService,
    private notificationService: NotificationService,
    private auditLogService: AuditLogService,
  ) {}

  async signin(loginDto: LoginUserDto, request?: any) {
    const { userId, password } = loginDto;
    const startTime = Date.now();
    const hashPassword = crypto.createHash('sha512').update(password).digest('hex');
    
    try {
      const findUser = await this.authService.validateUser(userId, hashPassword);
      
      if (!findUser) {
        // 로그인 실패 로그
        await this.auditLogService.log({
          action: AUDIT_ACTIONS.LOGIN_FAILED,
          userEmail: userId,
          details: {
            reason: 'Invalid credentials',
            duration: Date.now() - startTime,
          },
          category: AuditLogCategory.AUTHENTICATION,
          level: 'warn' as any,
          ipAddress: request?.ip,
          userAgent: request?.headers?.['user-agent'],
        });
        
        throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
      }
      
      // 사용자 상태 확인
      if (findUser.status === UserStatus.PENDING) {
        await this.auditLogService.log({
          action: AUDIT_ACTIONS.LOGIN_BLOCKED,
          userId: findUser.id.toString(),
          userName: findUser.name,
          userEmail: findUser.email,
          details: {
            reason: 'Account pending approval',
            duration: Date.now() - startTime,
          },
          category: AuditLogCategory.AUTHENTICATION,
          level: 'warn' as any,
          ipAddress: request?.ip,
          userAgent: request?.headers?.['user-agent'],
        });
        throw new HttpException('Account pending approval', HttpStatus.FORBIDDEN);
      }
      
      if (findUser.status === UserStatus.SUSPENDED) {
        await this.auditLogService.log({
          action: AUDIT_ACTIONS.LOGIN_BLOCKED,
          userId: findUser.id.toString(),
          userName: findUser.name,
          userEmail: findUser.email,
          details: {
            reason: 'Account suspended',
            duration: Date.now() - startTime,
          },
          category: AuditLogCategory.AUTHENTICATION,
          level: 'warn' as any,
          ipAddress: request?.ip,
          userAgent: request?.headers?.['user-agent'],
        });
        throw new HttpException('Account suspended', HttpStatus.FORBIDDEN);
      }
      
      if (findUser.status === UserStatus.DELETED) {
        await this.auditLogService.log({
          action: AUDIT_ACTIONS.LOGIN_BLOCKED,
          userId: findUser.id.toString(),
          userName: findUser.name,
          userEmail: findUser.email,
          details: {
            reason: 'Account deleted',
            duration: Date.now() - startTime,
          },
          category: AuditLogCategory.AUTHENTICATION,
          level: 'warn' as any,
          ipAddress: request?.ip,
          userAgent: request?.headers?.['user-agent'],
        });
        throw new HttpException('Account deleted', HttpStatus.FORBIDDEN);
      }
      
      // 로그인 성공 로그
      await this.auditLogService.log({
        action: AUDIT_ACTIONS.LOGIN_SUCCESS,
        userId: findUser.id.toString(),
        userName: findUser.name,
        userEmail: findUser.email,
        details: {
          duration: Date.now() - startTime,
        },
        category: AuditLogCategory.AUTHENTICATION,
        level: 'info' as any,
        ipAddress: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      });
      
      // 최종 로그인 시간 업데이트
      await this.userRepository.update(findUser.id, {
        lastLoginAt: new Date(),
      });
      
      return findUser;
    } catch (error) {
      // 예상치 못한 오류 로그
      if (!(error instanceof HttpException)) {
        await this.auditLogService.log({
          action: AUDIT_ACTIONS.LOGIN_ERROR,
          userEmail: userId,
          details: {
            error: error.message,
            duration: Date.now() - startTime,
          },
          category: AuditLogCategory.AUTHENTICATION,
          level: 'error' as any,
          ipAddress: request?.ip,
          userAgent: request?.headers?.['user-agent'],
        });
      }
      
      throw error;
    }
  }

  async signup(createLoginDto: CreateLoginDto) {
    // N+1 쿼리 방지: OR 조건을 사용하여 한 번의 쿼리로 email과 userId 중복 체크
    const existingUser = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email: createLoginDto.email })
      .orWhere('user.userId = :userId', { userId: createLoginDto.userId })
      .getOne();

    if (!existingUser) {
      const { email, password, userId } = createLoginDto;
      const hashPassword = crypto.createHash('sha512').update(password).digest('hex');
      
      // 트랜잭션 사용하여 사용자와 승인 요청 생성
      await this.userRepository.manager.transaction(async (manager) => {
        // 사용자 생성 (PENDING 상태)
        const createUserInfo = await manager.save(User, {
          email: email,
          password: hashPassword,
          userId: userId,
          jwtId: null,
          status: UserStatus.PENDING, // 승인 대기 상태
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        // 승인 요청 생성
        const approval = manager.create(UserApproval, {
          userId: createUserInfo.id.toString(),
          applicationNote: createLoginDto.applicationNote || null,
          status: ApprovalStatus.PENDING,
        });
        
        await manager.save(approval);
        
        // 관리자들에게 알림
        await this.notificationService.notifyAdmins({
          type: 'NEW_USER_REGISTRATION',
          data: {
            userId: createUserInfo.userId,
            userEmail: createUserInfo.email,
            userName: createUserInfo.name || createUserInfo.userId,
          },
        });
        
        // 가입 완료 이메일 (승인 대기 안내)
        await this.emailService.sendRegistrationPendingEmail(createUserInfo);
        
        // 회원가입 감사 로그
        await this.auditLogService.log({
          action: AUDIT_ACTIONS.USER_CREATED,
          resourceType: 'User',
          resourceId: createUserInfo.id.toString(),
          userId: createUserInfo.id.toString(),
          userName: createUserInfo.name || createUserInfo.userId,
          userEmail: createUserInfo.email,
          details: {
            registrationType: 'manual',
            status: UserStatus.PENDING,
          },
          category: AuditLogCategory.USER_MANAGEMENT,
          level: 'info' as any,
        });
      });
      
      return 'success';
    } else if (existingUser.userId === createLoginDto.userId) {
      throw new HttpException('conflict userId', HttpStatus.CONFLICT);
    } else {
      throw new HttpException('conflict email', HttpStatus.CONFLICT);
    }
  }
  
  async logout(userId: string, request?: any) {
    const user = await this.userRepository.findOne({
      where: { id: parseInt(userId) },
    });

    if (user) {
      await this.auditLogService.log({
        action: AUDIT_ACTIONS.LOGOUT,
        userId: user.id.toString(),
        userName: user.name,
        userEmail: user.email,
        details: {
          userAgent: request?.headers?.['user-agent'],
        },
        category: AuditLogCategory.AUTHENTICATION,
        level: 'info' as any,
        ipAddress: request?.ip,
        userAgent: request?.headers?.['user-agent'],
      });
    }
  }
}
