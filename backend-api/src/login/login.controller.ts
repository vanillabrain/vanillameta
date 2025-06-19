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
import { LoginUserDto } from '../login/dto/login-user.dto';
import { AuthService } from 'src/auth/auth.service';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';

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
  async logIn(@Res() res, @Req() req, @Body() loginDto: LoginUserDto, @I18n() i18n: I18nContext) {
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

    const message = await i18n.translate('auth.login.success');
    return res.status(201).json({ accessToken: accessToken, message });
  }

  // validationPipe = 들어오는 모든 클라이언트 페이로드에 대한 유효성 검사 규칙을 적용
  @UsePipes(ValidationPipe)
  @Post('signup')
  @ApiOperation({ summary: '회원가입' })
  async create(@Body() createUserDto: CreateLoginDto, @I18n() i18n: I18nContext) {
    const result = await this.loginService.signup(createUserDto);
    const message = await i18n.translate('auth.register.success');
    return { ...result, message };
  }

  @UseGuards(LocalAuthGuard) //refrshtoken 검사
  @Post('signout')
  @ApiOperation({ summary: '로그아웃' })
  async signOut(@Res() res, @Req() req, @I18n() i18n: I18nContext) {
    const { jwtId } = req.user.refreshKeyData;
    await this.authService.deleteRefreshToken(jwtId);
    const message = await i18n.translate('auth.logout.success');
    return res.status(201).clearCookie('jwt_re').json({ message });
  }
}
