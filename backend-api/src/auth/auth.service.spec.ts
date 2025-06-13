import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from 'src/user/entities/user.entity';
import { RefreshToken } from './entities/refresh_token.entity';
import {
  createMockRepository,
  createMockJwtService,
  getRepositoryTokenFor,
  mockErrorScenarios,
  withTimeout,
  retryTest,
} from '../../test/test-helpers';
import { JwtPayload } from './interfaces/jwt-payload.interface';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let jwtService: JwtService;

  const mockUser = {
    id: 1,
    userId: 'testuser',
    email: 'test@example.com',
    password: 'testpass',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockJwtPayload = {
    userId: 'testuser',
    email: 'test@example.com',
    id: 1,
  };

  const mockRefreshToken = {
    id: 1,
    refreshToken: 'existing-refresh-token',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // 환경 변수 Mock 설정
    process.env.ACCESS_SECRET = 'test-access-secret';
    process.env.REFRESH_SECRET = 'test-refresh-secret';
    process.env.URL_ACCESS_SECRET = 'test-url-access-secret';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: createMockJwtService(),
        },
        {
          provide: getRepositoryTokenFor(User),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryTokenFor(RefreshToken),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryTokenFor(User));
    refreshTokenRepository = module.get(getRepositoryTokenFor(RefreshToken));
    jwtService = module.get<JwtService>(JwtService);

    // Mock 초기화 - 각 테스트마다 완전히 새로운 mock 생성
    jest.clearAllMocks();

    // 완전히 새로운 mock 함수 생성
    userRepository = module.get(getRepositoryTokenFor(User));
    refreshTokenRepository = module.get(getRepositoryTokenFor(RefreshToken));

    // Mock 메소드들 재정의
    userRepository.findOne = jest.fn();
    userRepository.save = jest.fn();
    refreshTokenRepository.findOne = jest.fn();
    refreshTokenRepository.save = jest.fn();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', async () => {
      const result = await service.generateAccessToken(mockJwtPayload);

      expect(result).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { accessKeyData: mockJwtPayload },
        { secret: 'test-access-secret', expiresIn: '21600s' },
      );
    });

    it('should handle missing environment variable gracefully', async () => {
      delete process.env.ACCESS_SECRET;

      const result = await service.generateAccessToken(mockJwtPayload);
      expect(result).toBe('mock-jwt-token');
    });

    it('should generate different tokens for different payloads', async () => {
      const payload1 = { ...mockJwtPayload, userId: 'user1' };
      const payload2 = { ...mockJwtPayload, userId: 'user2' };

      await service.generateAccessToken(payload1);
      await service.generateAccessToken(payload2);

      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload', async () => {
      const result = await service.generateRefreshToken(mockJwtPayload);

      expect(result).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { refreshKeyData: mockJwtPayload },
        { secret: 'test-refresh-secret', expiresIn: '43200s' },
      );
    });

    it('should have longer expiration than access token', async () => {
      await service.generateRefreshToken(mockJwtPayload);

      const refreshCall = (jwtService.sign as jest.Mock).mock.calls.find(
        call => call[1].expiresIn === '43200s',
      );
      expect(refreshCall).toBeDefined();
    });
  });

  describe('generateUrlAccessToken', () => {
    it('should generate URL access token with hardcoded secret', async () => {
      const result = await service.generateUrlAccessToken(mockJwtPayload);

      expect(result).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        { accessKeyData: mockJwtPayload },
        { secret: 'test1234' },
      );
    });
  });

  describe('validateUser', () => {
    it('should validate user with correct credentials', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, password: 'testpass' });

      const result = await service.validateUser('testuser', 'testpass');

      expect(result).toBeDefined();
      expect(result.userId).toBe('testuser');
      expect(result.password).toBeUndefined(); // Password should be removed
    });

    it('should return undefined for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'anypass');

      expect(result).toBeUndefined();
    });

    it('should return undefined for incorrect password', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, password: 'correctpass' });

      const result = await service.validateUser('testuser', 'wrongpass');

      expect(result).toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      userRepository.findOne.mockRejectedValue(mockErrorScenarios.databaseConnectionError);

      await expect(service.validateUser('testuser', 'testpass')).rejects.toThrow(
        'Connection failed: ECONNREFUSED',
      );
    });
  });

  describe('setRefreshKey', () => {
    it('should create new refresh token when none exists', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await service.setRefreshKey('Bearer test-token', 1);

      expect(result).toEqual(mockRefreshToken);
      expect(refreshTokenRepository.save).toHaveBeenCalledWith({
        refreshToken: 'test-token',
      });
    });

    it('should update existing refresh token', async () => {
      const existingToken = { ...mockRefreshToken, refreshToken: 'old-token' };
      refreshTokenRepository.findOne.mockResolvedValue(existingToken);
      refreshTokenRepository.save.mockResolvedValue(existingToken);

      await service.setRefreshKey('Bearer new-token', 1);

      expect(existingToken.refreshToken).toBe('new-token');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(existingToken);
    });

    it('should handle Bearer prefix removal', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await service.setRefreshKey('Bearer prefix-test-token', 1);

      expect(refreshTokenRepository.save).toHaveBeenCalledWith({
        refreshToken: 'prefix-test-token',
      });
    });
  });

  describe('deleteRefreshToken', () => {
    it('should clear refresh token for user', async () => {
      const existingToken = { ...mockRefreshToken, refreshToken: 'existing-token' };
      refreshTokenRepository.findOne.mockResolvedValue(existingToken);
      refreshTokenRepository.save.mockResolvedValue(existingToken);

      await service.deleteRefreshToken(1);

      expect(existingToken.refreshToken).toBe('');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(existingToken);
    });

    it('should handle missing refresh token gracefully', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteRefreshToken(1)).rejects.toThrow();
    });
  });

  describe('verifyAccessToken', () => {
    beforeEach(() => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        accessKeyData: mockJwtPayload,
      });
    });

    it('should verify valid access token', async () => {
      const result = await service.verifyAccessToken('Bearer valid-token');

      expect(result).toEqual({ accessKeyData: mockJwtPayload });
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-access-secret',
      });
    });

    it('should remove Bearer prefix from token', async () => {
      await service.verifyAccessToken('Bearer token-without-prefix');

      expect(jwtService.verify).toHaveBeenCalledWith('token-without-prefix', {
        secret: 'test-access-secret',
      });
    });

    it('should throw HttpException for invalid token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyAccessToken('Bearer invalid-token')).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw 401 status for expired token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      try {
        await service.verifyAccessToken('Bearer expired-token');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(error.getResponse()).toEqual({ message: 'accessTokenExpired' });
      }
    });
  });

  describe('verifyRefreshToken', () => {
    beforeEach(() => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        refreshKeyData: mockJwtPayload,
      });
    });

    it('should verify valid refresh token', async () => {
      const result = await service.verifyRefreshToken('Bearer refreshToken=valid-token');

      expect(result).toEqual({ refreshKeyData: mockJwtPayload });
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-refresh-secret',
      });
    });

    it('should parse refreshToken from Bearer format', async () => {
      await service.verifyRefreshToken('Bearer refreshToken=parsed-token');

      expect(jwtService.verify).toHaveBeenCalledWith('parsed-token', {
        secret: 'test-refresh-secret',
      });
    });

    it('should throw HttpException for invalid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid refresh token');
      });

      await expect(service.verifyRefreshToken('Bearer refreshToken=invalid')).rejects.toThrow(
        HttpException,
      );
    });

    it('should throw 401 status for malformed refresh token', async () => {
      try {
        await service.verifyRefreshToken('Bearer malformed-token');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
      }
    });
  });

  describe('checkAccess', () => {
    it('should delegate to validateUser', async () => {
      userRepository.findOne.mockResolvedValue({ ...mockUser, password: 'testpass' });

      const result = await service.checkAccess('testuser', 'testpass');

      expect(result).toBeDefined();
      expect(result.userId).toBe('testuser');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full authentication flow', async () => {
      // 1. Validate user
      userRepository.findOne.mockResolvedValue({ ...mockUser, password: 'testpass' });
      const user = await service.validateUser('testuser', 'testpass');
      expect(user).toBeDefined();

      // 2. Generate tokens
      const accessToken = await service.generateAccessToken(mockJwtPayload);
      const refreshToken = await service.generateRefreshToken(mockJwtPayload);
      expect(accessToken).toBe('mock-jwt-token');
      expect(refreshToken).toBe('mock-jwt-token');

      // 3. Store refresh token
      refreshTokenRepository.findOne.mockResolvedValue(null);
      refreshTokenRepository.save.mockResolvedValue({ id: 1, refreshToken: 'stored-token' });
      await service.setRefreshKey('Bearer test-refresh-token', 1);

      // 4. Verify tokens
      (jwtService.verify as jest.Mock).mockReturnValue({ accessKeyData: mockJwtPayload });
      const verifiedAccessToken = await service.verifyAccessToken('Bearer ' + accessToken);
      expect(verifiedAccessToken).toBeDefined();
      expect(verifiedAccessToken.accessKeyData).toBeDefined();
      expect(verifiedAccessToken.accessKeyData.userId).toBe('testuser');

      // 5. Logout
      refreshTokenRepository.findOne.mockResolvedValue({ id: 1, refreshToken: 'existing-token' });
      refreshTokenRepository.save.mockResolvedValue({ id: 1, refreshToken: '' });
      await service.deleteRefreshToken(1);
    });

    it('should complete logout flow', async () => {
      const mockRefreshTokenEntity = {
        id: 1,
        refreshToken: 'existing-token',
        save: jest.fn(),
      };

      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshTokenEntity);
      refreshTokenRepository.save.mockResolvedValue({
        ...mockRefreshTokenEntity,
        refreshToken: '',
      });

      await service.deleteRefreshToken(1);

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(refreshTokenRepository.save).toHaveBeenCalledWith({
        ...mockRefreshTokenEntity,
        refreshToken: '',
      });
    });
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      const mockUser = {
        id: 1,
        userId: 'testuser',
        email: 'test@example.com',
        password: 'testpass',
      };
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('testuser', 'testpass');

      expect(result).toEqual({ id: 1, userId: 'testuser', email: 'test@example.com' });
      expect(result.password).toBeUndefined();
    });

    it('should return undefined when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('nonexistent', 'password');

      expect(result).toBeUndefined();
    });

    it('should return undefined when password is incorrect', async () => {
      const mockUser = {
        id: 1,
        userId: 'testuser',
        email: 'test@example.com',
        password: 'correctpass',
      };
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('testuser', 'wrongpass');

      expect(result).toBeUndefined();
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload and options', async () => {
      const result = await service.generateAccessToken(mockJwtPayload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { accessKeyData: mockJwtPayload },
        {
          secret: 'test-access-secret',
          expiresIn: '21600s',
        },
      );
      expect(result).toBe('mock-jwt-token');
    });

    it('should handle payload with partial data', async () => {
      const partialPayload = { userId: 'testuser', email: '', id: 0 };

      const result = await service.generateAccessToken(partialPayload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { accessKeyData: partialPayload },
        expect.objectContaining({
          secret: 'test-access-secret',
          expiresIn: '21600s',
        }),
      );
      expect(result).toBe('mock-jwt-token');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload and options', async () => {
      const result = await service.generateRefreshToken(mockJwtPayload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { refreshKeyData: mockJwtPayload },
        {
          secret: 'test-refresh-secret',
          expiresIn: '43200s',
        },
      );
      expect(result).toBe('mock-jwt-token');
    });
  });

  describe('setRefreshKey', () => {
    it('should create new refresh token when token does not exist', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      refreshTokenRepository.save.mockResolvedValue({ id: 1, refreshToken: 'new-token' });

      const result = await service.setRefreshKey('Bearer new-token', 1);

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(refreshTokenRepository.save).toHaveBeenCalledWith({
        refreshToken: 'new-token',
      });
      expect(result).toEqual({ id: 1, refreshToken: 'new-token' });
    });

    it('should update existing refresh token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue({
        ...mockRefreshToken,
        refreshToken: 'updated-token',
      });

      await service.setRefreshKey('Bearer updated-token', 1);

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRefreshToken.refreshToken).toBe('updated-token');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(mockRefreshToken);
    });

    it('should remove Bearer prefix from token', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);
      refreshTokenRepository.save.mockResolvedValue({
        id: 1,
        refreshToken: 'token-without-bearer',
      });

      await service.setRefreshKey('Bearer token-without-bearer', 1);

      expect(refreshTokenRepository.save).toHaveBeenCalledWith({
        refreshToken: 'token-without-bearer',
      });
    });
  });

  describe('deleteRefreshToken', () => {
    it('should clear refresh token for user', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue({
        ...mockRefreshToken,
        refreshToken: '',
      });

      await service.deleteRefreshToken(1);

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockRefreshToken.refreshToken).toBe('');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(mockRefreshToken);
    });
  });

  describe('verifyAccessToken', () => {
    beforeEach(() => {
      // JwtService의 verify 메서드를 직접 모킹
      jwtService.verify = jest.fn();
    });

    it('should verify valid access token', async () => {
      const mockDecoded = { accessKeyData: mockJwtPayload };
      (jwtService.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = await service.verifyAccessToken('Bearer valid-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: 'test-access-secret',
      });
      expect(result).toEqual(mockDecoded);
    });

    it('should throw HttpException for invalid token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyAccessToken('Bearer invalid-token')).rejects.toThrow(
        new HttpException({ message: 'accessTokenExpired' }, HttpStatus.UNAUTHORIZED),
      );
    });

    it('should remove Bearer prefix before verification', async () => {
      const mockDecoded = { accessKeyData: mockJwtPayload };
      (jwtService.verify as jest.Mock).mockReturnValue(mockDecoded);

      await service.verifyAccessToken('Bearer test-token');

      expect(jwtService.verify).toHaveBeenCalledWith('test-token', {
        secret: 'test-access-secret',
      });
    });
  });

  describe('verifyRefreshToken', () => {
    beforeEach(() => {
      jwtService.verify = jest.fn();
    });

    it('should verify valid refresh token', async () => {
      const mockDecoded = { refreshKeyData: mockJwtPayload };
      (jwtService.verify as jest.Mock).mockReturnValue(mockDecoded);

      const result = await service.verifyRefreshToken('Bearer refreshToken=valid-refresh-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
        secret: 'test-refresh-secret',
      });
      expect(result).toEqual(mockDecoded);
    });

    it('should throw HttpException for invalid refresh token', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.verifyRefreshToken('Bearer refreshToken=invalid-token')).rejects.toThrow(
        new HttpException({ message: 'refreshTokenExpired' }, HttpStatus.UNAUTHORIZED),
      );
    });

    it('should handle token parsing with Bearer and refreshToken= format', async () => {
      const mockDecoded = { refreshKeyData: mockJwtPayload };
      (jwtService.verify as jest.Mock).mockReturnValue(mockDecoded);

      await service.verifyRefreshToken('Bearer refreshToken=test-token');

      expect(jwtService.verify).toHaveBeenCalledWith('test-token', {
        secret: 'test-refresh-secret',
      });
    });
  });

  describe('checkAccess', () => {
    it('should return user data when credentials are valid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.checkAccess('testuser', 'testpass');

      expect(result).toEqual({
        id: 1,
        userId: 'testuser',
        email: 'test@example.com',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
      expect(result.password).toBeUndefined();
    });

    it('should call validateUser with provided credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      const validateUserSpy = jest.spyOn(service, 'validateUser');

      await service.checkAccess('testuser', 'testpass');

      expect(validateUserSpy).toHaveBeenCalledWith('testuser', 'testpass');

      // Spy 복원
      validateUserSpy.mockRestore();
    });

    it('should return undefined when credentials are invalid', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.checkAccess('wronguser', 'wrongpass');

      expect(result).toBeUndefined();
    });
  });

  describe('generateUrlAccessToken', () => {
    it('should generate URL access token with hardcoded secret', async () => {
      const result = await service.generateUrlAccessToken(mockJwtPayload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { accessKeyData: mockJwtPayload },
        {
          secret: 'test1234',
        },
      );
      expect(result).toBe('mock-jwt-token');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty user credentials', async () => {
      const result = await service.validateUser('', '');
      expect(result).toBeUndefined();
    });

    it('should handle null user credentials', async () => {
      const result = await service.validateUser(null as any, null as any);
      expect(result).toBeUndefined();
    });

    it('should handle user with null password', async () => {
      const userWithNullPassword = { ...mockUser, password: null };
      userRepository.findOne.mockResolvedValue(userWithNullPassword);

      const result = await service.validateUser('testuser', 'testpass');
      expect(result).toBeUndefined();
    });

    it('should handle refresh token operations with invalid user ID', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.setRefreshKey('Bearer token', -1);

      expect(refreshTokenRepository.findOne).toHaveBeenCalledWith({ where: { id: -1 } });
    });

    it('should generate tokens with special characters in payload', async () => {
      const specialPayload = {
        userId: 'user@domain.com',
        email: 'test+special@domain.co.kr',
        id: 999,
      };

      const result = await service.generateAccessToken(specialPayload);

      expect(jwtService.sign).toHaveBeenCalledWith(
        { accessKeyData: specialPayload },
        expect.objectContaining({
          secret: 'test-access-secret',
          expiresIn: '21600s',
        }),
      );
      expect(result).toBe('mock-jwt-token');
    });
  });

  describe('Integration Flow Tests', () => {
    it('should complete full authentication workflow', async () => {
      // 1. User login validation
      userRepository.findOne.mockResolvedValue({ ...mockUser, password: 'testpass' });
      const user = await service.validateUser('testuser', 'testpass');
      expect(user).toBeDefined();
      expect(user.password).toBeUndefined();

      // 2. Generate tokens after successful validation
      const accessToken = await service.generateAccessToken(mockJwtPayload);
      const refreshToken = await service.generateRefreshToken(mockJwtPayload);
      expect(accessToken).toBe('mock-jwt-token');
      expect(refreshToken).toBe('mock-jwt-token');

      // 3. Store refresh token
      refreshTokenRepository.findOne.mockResolvedValue(null);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
      const savedToken = await service.setRefreshKey(refreshToken, mockUser.id);
      expect(savedToken).toEqual(mockRefreshToken);

      // 4. Verify access token works
      (jwtService.verify as jest.Mock).mockReturnValue({ accessKeyData: mockJwtPayload });
      const verifiedToken = await service.verifyAccessToken('Bearer ' + accessToken);
      expect(verifiedToken.accessKeyData).toEqual(mockJwtPayload);

      // 5. Logout process
      refreshTokenRepository.findOne.mockResolvedValue(mockRefreshToken);
      await service.deleteRefreshToken(mockUser.id);
      expect(mockRefreshToken.refreshToken).toBe('');
    });

    it('should handle token refresh workflow', async () => {
      // 1. Login and get initial tokens
      userRepository.findOne.mockResolvedValue({ ...mockUser, password: 'testpass' });
      const user = await service.validateUser('testuser', 'testpass');
      const refreshToken = await service.generateRefreshToken(mockJwtPayload);

      // 2. Set refresh token in database
      refreshTokenRepository.findOne.mockResolvedValue(null);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);
      await service.setRefreshKey(refreshToken, user.id);

      // 3. Verify refresh token
      (jwtService.verify as jest.Mock).mockReturnValue({ refreshKeyData: mockJwtPayload });
      const verifiedRefresh = await service.verifyRefreshToken(
        'Bearer refreshToken=' + refreshToken,
      );
      expect(verifiedRefresh.refreshKeyData).toEqual(mockJwtPayload);

      // 4. Generate new access token
      const newAccessToken = await service.generateAccessToken(mockJwtPayload);
      expect(newAccessToken).toBeDefined();
    });
  });

  describe('Security and Performance Tests', () => {
    it('should handle SQL injection attempts in userId', async () => {
      const maliciousUserId = "admin'; DROP TABLE users; --";
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(maliciousUserId, 'password');

      expect(result).toBeUndefined();
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { userId: maliciousUserId } });
    });

    it('should handle bulk token generation efficiently', async () => {
      const promises = Array.from({ length: 50 }, () =>
        service.generateAccessToken(mockJwtPayload),
      );

      const tokens = await Promise.all(promises);
      expect(tokens).toHaveLength(50);
      tokens.forEach(token => expect(token).toBe('mock-jwt-token'));
    });

    it('should handle database connection failures gracefully', async () => {
      userRepository.findOne.mockRejectedValue(mockErrorScenarios.databaseConnectionError);

      await expect(service.validateUser('testuser', 'testpass')).rejects.toThrow(
        'Connection failed: ECONNREFUSED',
      );
    });
  });
});
