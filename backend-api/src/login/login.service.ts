import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { SampleService } from '../sample/sample.service';
import { hashPassword } from '../utils/password.util';
import { serializeMetadataWork } from '../common/metadata-work';

@Injectable()
export class LoginService {
  private readonly logger = new Logger(LoginService.name);

  constructor(
    private authService: AuthService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshRepository: Repository<RefreshToken>,
    private readonly sampleService: SampleService,
  ) {}

  async signin(loginDto: LoginUserDto) {
    const { userId, password } = loginDto;
    const findUser = await this.authService.validateUser(userId, password); // 요저의 존재여부 확인
    if (!findUser) {
      throw new UnauthorizedException(`Unauthorized`);
    }
    return findUser;
  }

  async signup(createLoginDto: CreateLoginDto) {
    // NFR005/008 (SQLite): on the single shared connection the duplicate lookup and the insert
    // share one metadata scope, so concurrent signups cannot both pass the read and insert.
    // Other drivers keep existing behavior; concurrent signup uniqueness outside SQLite is a follow-up.
    const created = await serializeMetadataWork(
      this.userRepository.manager.connection,
      async () => {
        const userInfoEmail = await this.userRepository.findOne({
          where: { email: createLoginDto.email },
        });
        const userInfoId = await this.userRepository.findOne({
          where: { userId: createLoginDto.userId },
        });

        if (!userInfoEmail && !userInfoId) {
          const { email, password, userId } = createLoginDto;
          return this.userRepository.save({
            email: email,
            password: hashPassword(password),
            userId: userId,
            jwtId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else if (!userInfoEmail && userInfoId) {
          throw new HttpException('conflict userId', HttpStatus.CONFLICT);
        }
        throw new HttpException('conflict email', HttpStatus.CONFLICT);
      },
    );

    // 온보딩 샘플 자산 프로비저닝 — 가입 metadata 범위를 벗어난 뒤 시작하고, 실패해도 가입은 유지한다.
    const createdUserInfoId = created.id;
    void (async () => {
      try {
        await this.sampleService.provisionForUser(createdUserInfoId);
      } catch (error) {
        this.logger.warn(
          `sample provisioning background failure for user ${createdUserInfoId}: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        );
      }
    })();
    return 'success';
  }
}
