import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { LoginService } from './login.service';
import { AuthService } from 'src/auth/auth.service';
import { User } from 'src/user/entities/user.entity';
import { RefreshToken } from 'src/auth/entities/refresh_token.entity';
import {
  createMockRepository,
  getRepositoryTokenFor,
  createMockService,
} from '../../test/test-helpers';

describe('LoginService', () => {
  let service: LoginService;
  let authService: any;
  let userRepository: any;
  let refreshRepository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
        {
          provide: AuthService,
          useValue: createMockService([
            'validateUser',
            'generateAccessToken',
            'generateRefreshToken',
            'setRefreshKey',
          ]),
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

    service = module.get<LoginService>(LoginService);
    authService = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryTokenFor(User));
    refreshRepository = module.get(getRepositoryTokenFor(RefreshToken));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signin', () => {
    it('should return user when credentials are valid', async () => {
      const loginDto = { userId: 'testuser', password: 'testpass' };
      const mockUser = { id: 1, userId: 'testuser', email: 'test@example.com' };

      authService.validateUser.mockResolvedValue(mockUser);

      const result = await service.signin(loginDto);

      expect(result).toEqual(mockUser);
      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.userId,
        expect.any(String), // hashed password
      );
    });

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      const loginDto = { userId: 'testuser', password: 'wrongpass' };

      authService.validateUser.mockResolvedValue(null);

      await expect(service.signin(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });
});
