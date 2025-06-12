import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from 'src/user/entities/user.entity';
import { RefreshToken } from './entites/refresh_token.entity';
import { createMockRepository, createMockJwtService, getRepositoryTokenFor } from '../../test/test-helpers';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let refreshTokenRepository: any;
  let jwtService: JwtService;

  beforeEach(async () => {
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password when credentials are valid', async () => {
      const mockUser = { id: 1, userId: 'testuser', email: 'test@example.com', password: 'testpass' };
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
      const mockUser = { id: 1, userId: 'testuser', email: 'test@example.com', password: 'correctpass' };
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser('testuser', 'wrongpass');
      
      expect(result).toBeUndefined();
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token successfully', async () => {
      const payload = { userId: 1, email: 'test@example.com', id: 1 };
      
      const result = await service.generateAccessToken(payload);
      
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toBe('mock-jwt-token');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token successfully', async () => {
      const payload = { userId: 1, email: 'test@example.com', id: 1 };
      
      const result = await service.generateRefreshToken(payload);
      
      expect(jwtService.sign).toHaveBeenCalled();
      expect(result).toBe('mock-jwt-token');
    });
  });
});
