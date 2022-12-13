import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UsePipes,
  ValidationPipe,
  Res,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import { LoginService } from './login.service';
import { CreateLoginDto } from './dto/create-login.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { LoginUserDto } from '../login/dto/login-user.dto';
import { AuthService } from 'src/auth/auth.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('로그인 관련 API')
@Controller('login')
export class LoginController {
  constructor(
    private readonly loginService: LoginService,
    private readonly authService: AuthService,
  ) {}

  @UsePipes(ValidationPipe)
  @Post('signin')
  @ApiOperation({ summary: ' 로그인 ' })
  async logIn(@Res() res, @Req() req, @Body() loginDto: LoginUserDto) {
    const findUser = await this.loginService.signin(loginDto);
    // 유저존재여부 확인
    const accessToken = await this.authService.generateAccessToken(findUser);
    // AccessToken발급
    const refreshToken = await this.authService.generateRefreshToken(findUser);
    // RefreshToken발급
    await this.authService.setRefreshKey(refreshToken, findUser.jwtId);
    // RefreshToken 저장

    res.cookie('jwt_re', refreshToken, {
      httpOnly: true, // 브라우저에서 cookie에 에 접근권한 x
      sameSite: 'Lax', // 다른 도메인의 cookie를 허용한 주소만 가져올 수 있음
      secure: true, // 보안처리된 https만 허
    });
    return res.status(201).json({ accessToken: accessToken, message: 'success' });
  }

  // validationPipe = 들어오는 모든 클라이언트 페이로드에 대한 유효성 검사 규칙을 적용
  @UsePipes(ValidationPipe)
  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  create(@Body() createUserDto: CreateLoginDto) {
    return this.loginService.signup(createUserDto);
  }

  @UseGuards(LocalAuthGuard) //refrshtoken 검사
  @Post('signout')
  @ApiOperation({ summary: '로그아웃' })
  async signOut(@Res() res, @Req() req) {
    const { jwtId } = req.user.refreshKeyData;
    await this.authService.deleteRefreshToken(jwtId);
    return res.status(201).clearCookie('jwt_re').json({ message: 'success' });
  }
}
