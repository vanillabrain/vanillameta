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
  ) {}

  async signin(loginDto: LoginUserDto) {
    const { userId, password } = loginDto;
    // const salt = crypto.randomBytes(128).toString('base64');
    const hashPassword = crypto.createHash('sha512').update(password).digest('hex');
    console.log(hashPassword);
    const findUser = await this.authService.validateUser(userId, hashPassword); // 요저의 존재여부 확인
    if (!findUser) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    
    // PENDING 상태인 사용자는 로그인 불가
    if (findUser.status === UserStatus.PENDING) {
      throw new HttpException('Account pending approval', HttpStatus.FORBIDDEN);
    }
    
    // SUSPENDED 상태인 사용자는 로그인 불가
    if (findUser.status === UserStatus.SUSPENDED) {
      throw new HttpException('Account suspended', HttpStatus.FORBIDDEN);
    }
    
    // DELETED 상태인 사용자는 로그인 불가
    if (findUser.status === UserStatus.DELETED) {
      throw new HttpException('Account deleted', HttpStatus.FORBIDDEN);
    }
    
    return findUser;
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
      });
      
      return 'success';
    } else if (existingUser.userId === createLoginDto.userId) {
      throw new HttpException('conflict userId', HttpStatus.CONFLICT);
    } else {
      throw new HttpException('conflict email', HttpStatus.CONFLICT);
    }
  }
}
