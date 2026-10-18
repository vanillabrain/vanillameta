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
import { QueryFailedError, Repository } from 'typeorm';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { SampleService } from '../sample/sample.service';
import { hashPassword } from '../utils/password.util';
import { serializeMetadataWork } from '../common/metadata-work';

type IdentityField = 'email' | 'userId';

const identityConflict = (field: IdentityField) =>
  new HttpException(`conflict ${field}`, HttpStatus.CONFLICT);

/**
 * True only when the driver rejected an insert because a unique index was already satisfied.
 * The public code/message surface is used as-is; SQL text, bound parameters, index names, and
 * private driver internals stay untouched, and the conflicting field is derived by rereading the
 * identity columns instead. SQLite reports UNIQUE and FOREIGN KEY failures under the same
 * SQLITE_CONSTRAINT code, so a foreign-key failure must not be mistaken for an identity race.
 */
function isIdentityUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: unknown; errno?: unknown; message?: unknown };
  const code = typeof driverError?.code === 'string' ? driverError.code : '';
  if (code === 'ER_DUP_ENTRY' || driverError?.errno === 1062) return true;
  if (code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const message = `${String(driverError?.message ?? '')} ${String(error.message ?? '')}`;
    return /UNIQUE constraint failed/i.test(message) && !/FOREIGN KEY/i.test(message);
  }
  return false;
}

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
    const { email, password, userId } = createLoginDto;
    // NFR005/008 (SQLite): on the single shared connection the duplicate lookup and the insert
    // share one metadata scope, so concurrent signups cannot both pass the read and insert.
    // Migrated unique indexes settle cross-connection races on every configured metadata engine.
    const created = await serializeMetadataWork(
      this.userRepository.manager.connection,
      async () => {
        const existing = await this.findIdentityConflict(email, userId);
        if (existing) throw identityConflict(existing);

        try {
          const saved = await this.userRepository.save({
            email: email,
            password: hashPassword(password),
            userId: userId,
            jwtId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          return saved;
        } catch (error) {
          // The prechecks are advisory: a concurrent signup can still commit between the reads
          // and this insert. The unique index is the last word, so a duplicate-entry failure is
          // mapped back to whichever identity column now exists. The reread runs after the failed
          // statement with no surrounding transaction, so it never talks to a dead transaction.
          if (!isIdentityUniqueViolation(error)) throw error;
          const raced = await this.findIdentityConflict(email, userId);
          if (!raced) throw error;
          throw identityConflict(raced);
        }
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

  /** Identity columns are read in the same order the precheck reports them: email first. */
  private async findIdentityConflict(email: string, userId: string): Promise<IdentityField | null> {
    if (await this.userRepository.findOne({ where: { email } })) return 'email';
    if (await this.userRepository.findOne({ where: { userId } })) return 'userId';
    return null;
  }
}
