import { Module } from '@nestjs/common';
import { LoginService } from './login.service';
import { LoginController } from './login.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { UserInfo } from '../user/entities/user-info.entity.js';
import { RefreshToken } from '../auth/entites/refresh_token.entity.js'
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from 'src/auth/auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserInfo, RefreshToken, User]), JwtModule],
  controllers: [LoginController],
  providers: [LoginService, AuthService]
})
export class LoginModule {}
