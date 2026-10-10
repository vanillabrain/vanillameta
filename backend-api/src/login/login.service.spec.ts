import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LoginService } from './login.service';
import { AuthService } from '../auth/auth.service';
import { SampleService } from '../sample/sample.service';
import { User } from '../user/entities/user.entity';
import { RefreshToken } from '../auth/entites/refresh_token.entity';

describe('LoginService', () => {
  let service: LoginService;
  const mockRepository = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
        { provide: getRepositoryToken(User), useFactory: mockRepository },
        { provide: getRepositoryToken(RefreshToken), useFactory: mockRepository },
        { provide: AuthService, useValue: {} },
        { provide: SampleService, useValue: { provisionForUser: jest.fn() } },
      ],
    }).compile();

    service = module.get<LoginService>(LoginService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
