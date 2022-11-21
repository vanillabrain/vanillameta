import { Module } from '@nestjs/common';
import { UserModule } from 'src/user/user.module';
import { AuthService } from './auth.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity.js';
import { UserService } from 'src/user/user.service';

@Module({
  imports: [
      TypeOrmModule.forFeature([User]),
      PassportModule,
      JwtModule.register({
        secret: process.env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: '30s'}
    })
  ],
  providers: [AuthService]
})
export class AuthModule {}