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
  HttpStatus,
} from '@nestjs/common';
import { LoginService } from './login.service';
import { CreateLoginDto } from './dto/create-login.dto';
import { LoginUserDto } from '../login/dto/login-user.dto';
import { AuthService } from 'src/auth/auth.service';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';
import {
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
// import { I18n, I18nContext } from 'nestjs-i18n'; // removed due to dependency issue

@ApiTags('인증')
@Controller('login')
export class LoginController {
  constructor(
    private readonly loginService: LoginService,
    private readonly authService: AuthService,
  ) {}

  @UsePipes(ValidationPipe)
  @Post('signin')
  @ApiOperation({
    summary: '사용자 로그인',
    description: '이메일과 비밀번호로 로그인하여 JWT 액세스 토큰을 발급받습니다.',
  })
  @ApiBody({ type: LoginUserDto })
  @ApiCreatedResponse({
    description: '로그인 성공',
    schema: {
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT 액세스 토큰',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        message: {
          type: 'string',
          example: 'success',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 (유효성 검사 실패)' })
  @ApiUnauthorizedResponse({ description: '인증 실패 (이메일 또는 비밀번호 오류)' })
  async logIn(@Res() res, @Req() req, @Body() loginDto: LoginUserDto) {
    const findUser = await this.loginService.signin(loginDto, req);
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

    const message = 'success';
    return res.status(201).json({ accessToken: accessToken, message });
  }

  // validationPipe = 들어오는 모든 클라이언트 페이로드에 대한 유효성 검사 규칙을 적용
  @UsePipes(ValidationPipe)
  @Post('signup')
  @ApiOperation({
    summary: '회원가입',
    description: '새로운 사용자 계정을 생성합니다.',
  })
  @ApiBody({ type: CreateLoginDto })
  @ApiCreatedResponse({
    description: '회원가입 성공',
    schema: {
      properties: {
        userId: { type: 'string' },
        userEmail: { type: 'string' },
        message: { type: 'string', example: 'success' },
      },
    },
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 (유효성 검사 실패 또는 중복된 이메일)' })
  async create(@Body() createUserDto: CreateLoginDto) {
    const result = await this.loginService.signup(createUserDto);
    const message = 'success';
    return { result, message };
  }

  @UseGuards(LocalAuthGuard) //refrshtoken 검사
  @Post('signout')
  @ApiBearerAuth('AccessToken')
  @ApiOperation({
    summary: '로그아웃',
    description: '현재 세션을 종료하고 리프레시 토큰을 삭제합니다.',
  })
  @ApiCreatedResponse({
    description: '로그아웃 성공',
    schema: {
      properties: {
        message: { type: 'string', example: 'success' },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async signOut(@Res() res, @Req() req) {
    const { jwtId, userId } = req.user.refreshKeyData;
    await this.authService.deleteRefreshToken(jwtId);
    await this.loginService.logout(userId, req);
    const message = 'success';
    return res.status(201).clearCookie('jwt_re').json({ message });
  }
}
