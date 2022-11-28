import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserInfo } from './entities/user-info.entity.js';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from 'src/auth/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { RefreshToken } from 'src/auth/entites/refresh_token.entity';
import { User } from './entities/user.entity';
import { Dashboard } from 'src/dashboard/entities/dashboard.entity';


@Module({
  imports: [TypeOrmModule.forFeature([UserInfo, RefreshToken, User, Dashboard]), JwtModule],
  controllers: [UserController],
  providers: [UserService, AuthService]
})
export class UserModule {}

