# VanillaMeta 보안 가이드라인

## 목차
1. [개요](#개요)
2. [인증 및 인가](#인증-및-인가)
3. [데이터 암호화](#데이터-암호화)
4. [SQL Injection 방지](#sql-injection-방지)
5. [OWASP Top 10 대응](#owasp-top-10-대응)
6. [보안 체크리스트](#보안-체크리스트)
7. [보안 모니터링](#보안-모니터링)

## 개요

VanillaMeta는 기업의 중요한 데이터베이스에 접근하는 BI 도구로서, 최고 수준의 보안을 유지해야 합니다. 이 문서는 개발부터 운영까지 전 과정에서 준수해야 할 보안 가이드라인을 제공합니다.

### 핵심 보안 원칙
- **최소 권한 원칙**: 필요한 최소한의 권한만 부여
- **심층 방어**: 다중 보안 계층 적용
- **Zero Trust**: 모든 요청을 검증
- **보안 기본값**: 안전한 기본 설정 사용

## 인증 및 인가

### 1. JWT 토큰 보안

#### 토큰 생성 및 관리
```typescript
// auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      // 민감한 정보는 토큰에 포함하지 않음
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m', // 짧은 만료 시간
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    // 리프레시 토큰 해시하여 저장
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.saveRefreshToken(user.id, hashedRefreshToken);

    return { accessToken, refreshToken };
  }
}
```

#### 토큰 검증 강화
```typescript
// jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private userService: UserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      algorithms: ['HS256'], // 알고리즘 명시
    });
  }

  async validate(payload: any) {
    // 추가 검증 로직
    const user = await this.userService.findOne(payload.sub);
    
    if (!user || user.isBlocked) {
      throw new UnauthorizedException('Invalid token');
    }

    // IP 주소 검증 (선택적)
    if (user.allowedIps && !user.allowedIps.includes(request.ip)) {
      throw new UnauthorizedException('IP not allowed');
    }

    return user;
  }
}
```

### 2. 세션 관리

#### 동시 세션 제한
```typescript
// session.service.ts
@Injectable()
export class SessionService {
  async createSession(userId: string, deviceInfo: DeviceInfo) {
    // 기존 세션 확인
    const activeSessions = await this.getActiveSessions(userId);
    
    if (activeSessions.length >= MAX_CONCURRENT_SESSIONS) {
      // 가장 오래된 세션 종료
      await this.terminateOldestSession(userId);
    }

    // 새 세션 생성
    return this.sessionRepository.save({
      userId,
      deviceInfo,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });
  }

  async validateSession(sessionId: string) {
    const session = await this.sessionRepository.findOne(sessionId);
    
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    // 세션 타임아웃 확인 (30분)
    const inactiveTime = Date.now() - session.lastActivityAt.getTime();
    if (inactiveTime > 30 * 60 * 1000) {
      await this.terminateSession(sessionId);
      throw new UnauthorizedException('Session expired');
    }

    // 활동 시간 업데이트
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    return session;
  }
}
```

### 3. 역할 기반 접근 제어 (RBAC)

#### 권한 데코레이터
```typescript
// decorators/roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// 사용 예시
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('users')
  @Roles(Role.ADMIN)
  getUsers() {
    // 관리자만 접근 가능
  }
}
```

## 데이터 암호화

### 1. 저장 데이터 암호화 (Encryption at Rest)

#### 민감한 필드 암호화
```typescript
// transformers/encryption.transformer.ts
export class EncryptionTransformer implements ValueTransformer {
  private algorithm = 'aes-256-gcm';
  private key = Buffer.from(process.env.ENCRYPTION_KEY, 'base64');

  to(value: string): string {
    if (!value) return value;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      authTag: authTag.toString('hex'),
      iv: iv.toString('hex'),
    });
  }

  from(value: string): string {
    if (!value) return value;

    const { encrypted, authTag, iv } = JSON.parse(value);
    
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Entity에서 사용
@Entity()
export class Database {
  @Column({
    transformer: new EncryptionTransformer(),
  })
  password: string;

  @Column({
    transformer: new EncryptionTransformer(),
  })
  connectionString: string;
}
```

### 2. 전송 데이터 암호화 (Encryption in Transit)

#### HTTPS 강제 및 HSTS
```typescript
// security-headers.middleware.ts
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // HTTPS 강제 리다이렉트
    if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }

    // 보안 헤더 설정
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

    next();
  }
}
```

### 3. 키 관리

#### AWS KMS 통합
```typescript
// kms.service.ts
@Injectable()
export class KmsService {
  private kms: AWS.KMS;

  constructor() {
    this.kms = new AWS.KMS({
      region: process.env.AWS_REGION,
    });
  }

  async encrypt(plaintext: string): Promise<string> {
    const params = {
      KeyId: process.env.KMS_KEY_ID,
      Plaintext: Buffer.from(plaintext),
    };

    const { CiphertextBlob } = await this.kms.encrypt(params).promise();
    return CiphertextBlob.toString('base64');
  }

  async decrypt(ciphertext: string): Promise<string> {
    const params = {
      CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    };

    const { Plaintext } = await this.kms.decrypt(params).promise();
    return Plaintext.toString();
  }
}
```

## SQL Injection 방지

### 1. 파라미터화된 쿼리

#### Knex.js 사용 예시
```typescript
// connection.service.ts
@Injectable()
export class ConnectionService {
  async executeQuery(databaseId: string, sql: string, params: any[] = []) {
    const knex = await this.getKnexConnection(databaseId);
    
    // 파라미터화된 쿼리 실행
    try {
      // 위험: 직접 문자열 연결
      // const dangerousQuery = `SELECT * FROM users WHERE id = ${userId}`;
      
      // 안전: 파라미터 바인딩
      const safeQuery = knex('users')
        .select('*')
        .where('id', '=', params[0])
        .toString();
      
      return await knex.raw(safeQuery);
    } catch (error) {
      throw new BadRequestException('Query execution failed');
    }
  }
}
```

### 2. SQL 검증 및 필터링

#### SQL 검증 서비스
```typescript
// sql-validation.service.ts
@Injectable()
export class SqlValidationService {
  private readonly dangerousPatterns = [
    /(\b(DELETE|DROP|EXEC(UTE)?|INSERT|UPDATE)\b)/gi,
    /(--)|(\/*)|(*\/)|(\+\s*OR\s+\w+\s*=\s*\w+)/gi,
    /(\bUNION\b.*\bSELECT\b)/gi,
    /(;|\||&&)/g, // 명령어 체이닝 방지
  ];

  private readonly allowedStatements = ['SELECT'];

  validateQuery(sql: string, options: ValidationOptions = {}): ValidationResult {
    const normalizedSql = sql.trim().toUpperCase();
    
    // 1. 허용된 명령문 확인
    const firstWord = normalizedSql.split(/\s+/)[0];
    if (!this.allowedStatements.includes(firstWord)) {
      return {
        valid: false,
        error: `Only ${this.allowedStatements.join(', ')} statements are allowed`,
      };
    }

    // 2. 위험한 패턴 검사
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(sql)) {
        return {
          valid: false,
          error: 'Query contains potentially dangerous patterns',
        };
      }
    }

    // 3. 테이블 권한 확인
    if (options.allowedTables) {
      const tables = this.extractTableNames(sql);
      const unauthorizedTables = tables.filter(
        table => !options.allowedTables.includes(table)
      );
      
      if (unauthorizedTables.length > 0) {
        return {
          valid: false,
          error: `Access denied to tables: ${unauthorizedTables.join(', ')}`,
        };
      }
    }

    return { valid: true };
  }

  private extractTableNames(sql: string): string[] {
    // SQL 파서를 사용하여 테이블명 추출
    const parser = new SqlParser();
    const ast = parser.parse(sql);
    return this.getTablesFromAst(ast);
  }
}
```

### 3. 읽기 전용 데이터베이스 사용자

```sql
-- 읽기 전용 사용자 생성
CREATE USER 'vanillameta_readonly'@'%' IDENTIFIED BY 'strong_password';

-- SELECT 권한만 부여
GRANT SELECT ON database_name.* TO 'vanillameta_readonly'@'%';

-- 특정 테이블에 대한 권한 제한
GRANT SELECT ON database_name.safe_table1 TO 'vanillameta_readonly'@'%';
GRANT SELECT ON database_name.safe_table2 TO 'vanillameta_readonly'@'%';

-- 시스템 테이블 접근 차단
REVOKE ALL PRIVILEGES ON mysql.* FROM 'vanillameta_readonly'@'%';
REVOKE ALL PRIVILEGES ON information_schema.* FROM 'vanillameta_readonly'@'%';
```

## OWASP Top 10 대응

### 1. A01:2021 – 접근 제어 실패

#### 리소스 소유권 검증
```typescript
// guards/ownership.guard.ts
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dashboardService: DashboardService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const dashboardId = request.params.id;

    const dashboard = await this.dashboardService.findOne(dashboardId);
    
    if (!dashboard) {
      throw new NotFoundException('Dashboard not found');
    }

    // 소유권 확인
    if (dashboard.userId !== user.id && !user.roles.includes('admin')) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
```

### 2. A02:2021 – 암호화 실패

#### 비밀번호 정책
```typescript
// password-policy.service.ts
@Injectable()
export class PasswordPolicyService {
  private readonly minLength = 12;
  private readonly requirements = [
    { regex: /[A-Z]/, message: '대문자 포함 필요' },
    { regex: /[a-z]/, message: '소문자 포함 필요' },
    { regex: /[0-9]/, message: '숫자 포함 필요' },
    { regex: /[!@#$%^&*]/, message: '특수문자 포함 필요' },
  ];

  validatePassword(password: string): ValidationResult {
    const errors = [];

    if (password.length < this.minLength) {
      errors.push(`최소 ${this.minLength}자 이상`);
    }

    for (const requirement of this.requirements) {
      if (!requirement.regex.test(password)) {
        errors.push(requirement.message);
      }
    }

    // 일반적인 패스워드 체크
    if (this.isCommonPassword(password)) {
      errors.push('너무 일반적인 비밀번호입니다');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}
```

### 3. A03:2021 – 인젝션

#### 입력 검증 및 살균
```typescript
// pipes/sanitize-input.pipe.ts
@Injectable()
export class SanitizeInputPipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      // HTML 태그 제거
      value = value.replace(/<[^>]*>/g, '');
      
      // 특수 문자 이스케이프
      value = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    }
    
    return value;
  }
}

// 사용 예시
@Post('comment')
createComment(
  @Body('content', SanitizeInputPipe) content: string,
) {
  // 살균된 입력 사용
}
```

### 4. A04:2021 – 안전하지 않은 설계

#### 위협 모델링 구현
```typescript
// threat-model.service.ts
@Injectable()
export class ThreatModelService {
  analyzeThreat(operation: string, context: any) {
    const threats = [];

    // 대량 데이터 추출 시도 감지
    if (operation === 'QUERY' && this.isLargeDataExtraction(context)) {
      threats.push({
        type: 'DATA_EXFILTRATION',
        severity: 'HIGH',
        action: 'LIMIT_RESULTS',
      });
    }

    // 비정상적인 접근 패턴
    if (this.isAnomalousAccess(context)) {
      threats.push({
        type: 'SUSPICIOUS_ACTIVITY',
        severity: 'MEDIUM',
        action: 'LOG_AND_MONITOR',
      });
    }

    return threats;
  }

  private isLargeDataExtraction(context: any): boolean {
    return context.rowCount > 10000 || context.noLimit;
  }
}
```

### 5. A05:2021 – 보안 설정 오류

#### 보안 설정 검증
```typescript
// security-config.validator.ts
export class SecurityConfigValidator {
  static validate() {
    const errors = [];

    // 환경 변수 검증
    const requiredEnvVars = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY',
      'DB_PASSWORD',
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`);
      }
    }

    // 약한 시크릿 검사
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET is too weak');
    }

    // 프로덕션 설정 검증
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DEBUG === 'true') {
        errors.push('DEBUG mode should be disabled in production');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Security configuration errors:\n${errors.join('\n')}`);
    }
  }
}
```

### 6. A06:2021 – 취약하고 오래된 구성 요소

#### 의존성 보안 검사
```json
// package.json
{
  "scripts": {
    "security:check": "npm audit",
    "security:fix": "npm audit fix",
    "dependency:check": "npm-check-updates"
  },
  "husky": {
    "hooks": {
      "pre-commit": "npm run security:check"
    }
  }
}
```

### 7. A07:2021 – 식별 및 인증 실패

#### 다중 인증 (MFA)
```typescript
// mfa.service.ts
@Injectable()
export class MfaService {
  async generateSecret(userId: string): Promise<string> {
    const secret = speakeasy.generateSecret({
      name: `VanillaMeta (${userId})`,
    });

    await this.userService.updateMfaSecret(userId, secret.base32);
    
    return secret.otpauth_url;
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const user = await this.userService.findOne(userId);
    
    return speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2, // 2 * 30초 윈도우
    });
  }
}
```

### 8. A08:2021 – 소프트웨어 및 데이터 무결성 실패

#### 데이터 무결성 검증
```typescript
// integrity.service.ts
@Injectable()
export class IntegrityService {
  generateChecksum(data: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  verifyIntegrity(data: any, checksum: string): boolean {
    const currentChecksum = this.generateChecksum(data);
    return currentChecksum === checksum;
  }

  // 위젯 설정 무결성 검증
  async saveWidget(widget: Widget) {
    widget.checksum = this.generateChecksum(widget.options);
    return this.widgetRepository.save(widget);
  }

  async loadWidget(id: string): Promise<Widget> {
    const widget = await this.widgetRepository.findOne(id);
    
    if (!this.verifyIntegrity(widget.options, widget.checksum)) {
      throw new Error('Widget data integrity compromised');
    }
    
    return widget;
  }
}
```

### 9. A09:2021 – 보안 로깅 및 모니터링 실패

#### 보안 이벤트 로깅
```typescript
// security-logger.service.ts
@Injectable()
export class SecurityLoggerService {
  private readonly logger = new Logger('Security');

  logSecurityEvent(event: SecurityEvent) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      userId: event.userId,
      ip: event.ip,
      userAgent: event.userAgent,
      details: event.details,
      severity: event.severity,
    };

    // 로컬 로그
    this.logger.log(JSON.stringify(logEntry));

    // CloudWatch 로그
    this.cloudWatchService.logSecurityEvent(logEntry);

    // 심각한 이벤트는 알림
    if (event.severity === 'CRITICAL') {
      this.alertService.sendSecurityAlert(logEntry);
    }
  }

  // 보안 이벤트 타입
  logFailedLogin(userId: string, ip: string) {
    this.logSecurityEvent({
      type: 'FAILED_LOGIN',
      userId,
      ip,
      severity: 'MEDIUM',
    });
  }

  logSuspiciousQuery(userId: string, query: string) {
    this.logSecurityEvent({
      type: 'SUSPICIOUS_QUERY',
      userId,
      details: { query },
      severity: 'HIGH',
    });
  }
}
```

### 10. A10:2021 – 서버 사이드 요청 위조 (SSRF)

#### SSRF 방지
```typescript
// url-validator.service.ts
@Injectable()
export class UrlValidatorService {
  private readonly blacklistedIPs = [
    '127.0.0.1',
    '0.0.0.0',
    'localhost',
    '169.254.169.254', // AWS 메타데이터
  ];

  private readonly allowedProtocols = ['https'];

  async validateUrl(url: string): Promise<boolean> {
    try {
      const parsed = new URL(url);

      // 프로토콜 검증
      if (!this.allowedProtocols.includes(parsed.protocol.slice(0, -1))) {
        throw new Error('Invalid protocol');
      }

      // IP 주소 확인
      const ip = await this.resolveIP(parsed.hostname);
      
      if (this.isPrivateIP(ip) || this.blacklistedIPs.includes(ip)) {
        throw new Error('Access to internal resources is not allowed');
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  private isPrivateIP(ip: string): boolean {
    const parts = ip.split('.');
    return (
      parts[0] === '10' ||
      (parts[0] === '172' && parseInt(parts[1]) >= 16 && parseInt(parts[1]) <= 31) ||
      (parts[0] === '192' && parts[1] === '168')
    );
  }
}
```

## 보안 체크리스트

### 개발 단계
- [ ] 코드 리뷰에서 보안 이슈 확인
- [ ] 의존성 취약점 스캔 (npm audit)
- [ ] 정적 코드 분석 도구 실행
- [ ] 민감한 정보 하드코딩 여부 확인
- [ ] SQL 인젝션 취약점 테스트
- [ ] XSS 취약점 테스트
- [ ] CSRF 보호 구현 확인

### 배포 전
- [ ] 환경 변수 설정 확인
- [ ] HTTPS 설정 확인
- [ ] 보안 헤더 설정 확인
- [ ] 로깅 설정 확인
- [ ] 백업 및 복구 계획 수립
- [ ] 침투 테스트 수행
- [ ] 보안 모니터링 설정

### 운영 중
- [ ] 정기적인 보안 업데이트
- [ ] 로그 모니터링
- [ ] 이상 징후 탐지
- [ ] 정기적인 취약점 스캔
- [ ] 보안 사고 대응 훈련
- [ ] 접근 권한 정기 검토

## 보안 모니터링

### 1. 실시간 위협 감지

#### CloudWatch 알람 설정
```yaml
# cloudformation/security-alarms.yml
Resources:
  FailedLoginAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: VanillaMeta-Failed-Login-Attempts
      MetricName: FailedLoginAttempts
      Namespace: VanillaMeta/Security
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      AlarmActions:
        - !Ref SecurityAlertTopic

  SuspiciousQueryAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: VanillaMeta-Suspicious-Queries
      MetricName: SuspiciousQueries
      Namespace: VanillaMeta/Security
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 1
      Threshold: 1
      ComparisonOperator: GreaterThanThreshold
```

### 2. 보안 대시보드

#### Grafana 대시보드 설정
```json
{
  "dashboard": {
    "title": "VanillaMeta Security Dashboard",
    "panels": [
      {
        "title": "Failed Login Attempts",
        "targets": [
          {
            "expr": "sum(rate(failed_login_total[5m]))"
          }
        ]
      },
      {
        "title": "SQL Injection Attempts",
        "targets": [
          {
            "expr": "sum(sql_injection_attempts_total)"
          }
        ]
      },
      {
        "title": "API Error Rates",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total{status=~\"4..\"}[5m]))"
          }
        ]
      }
    ]
  }
}
```

### 3. 보안 사고 대응

#### 사고 대응 프로세스
```typescript
// incident-response.service.ts
@Injectable()
export class IncidentResponseService {
  async handleSecurityIncident(incident: SecurityIncident) {
    // 1. 격리
    await this.isolateAffectedResources(incident);
    
    // 2. 조사
    const investigation = await this.investigateIncident(incident);
    
    // 3. 복구
    await this.recoverFromIncident(incident, investigation);
    
    // 4. 보고
    await this.reportIncident(incident, investigation);
    
    // 5. 개선
    await this.implementPreventiveMeasures(investigation);
  }

  private async isolateAffectedResources(incident: SecurityIncident) {
    switch (incident.type) {
      case 'COMPROMISED_ACCOUNT':
        await this.userService.blockUser(incident.userId);
        await this.sessionService.terminateAllSessions(incident.userId);
        break;
      
      case 'SQL_INJECTION':
        await this.databaseService.revokeAccess(incident.databaseId);
        break;
    }
  }
}
```

## 보안 교육 및 인식

### 개발팀 교육
- 정기적인 보안 교육 실시
- OWASP Top 10 이해
- 안전한 코딩 실습
- 보안 도구 사용법

### 보안 문화 구축
- 보안 챔피언 프로그램
- 버그 바운티 프로그램
- 정기적인 보안 리뷰
- 보안 사고 공유 및 학습