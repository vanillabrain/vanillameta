import { Module } from '@nestjs/common';
import { UserModule } from 'src/user/user.module';
import { AuthService } from './auth.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserInfo } from '../user/entities/user-info.entity.js';
import { UserService } from 'src/user/user.service';
import { LocalStrategy } from '../auth/strategies/local.strategy.js'
import { RefreshToken } from './entites/refresh_token.entity';

@Module({
  imports: [
      TypeOrmModule.forFeature([UserInfo, RefreshToken]),
      PassportModule,
      JwtModule.register({
        secret: process.env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: '1200s'}
    })
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy]
})
export class AuthModule {}
