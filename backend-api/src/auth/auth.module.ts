import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserInfo } from '../user/entities/user-info.entity.js';
import { LocalStrategy } from '../auth/strategies/local.strategy.js';
import { RefreshToken } from './entites/refresh_token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserInfo, RefreshToken]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: '60s' },
    }),
  ],
  providers: [AuthService, JwtStrategy, LocalStrategy],
})
export class AuthModule {}
