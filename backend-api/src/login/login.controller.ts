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
import { ApiOperation, ApiTags, ApiResponse, ApiBody } from '@nestjs/swagger';

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
    summary: '로그인',
    description:
      '이메일과 비밀번호로 로그인합니다. 성공 시 JWT 액세스 토큰과 리프레시 토큰을 발급합니다.',
  })
  @ApiBody({
    type: LoginUserDto,
    description: '로그인 정보',
  })
  @ApiResponse({
    status: 201,
    description: '로그인 성공',
    schema: {
      type: 'object',
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
    headers: {
      'Set-Cookie': {
        description: '리프레시 토큰 쿠키 (jwt_re)',
        schema: {
          type: 'string',
          example: 'jwt_re=token; HttpOnly; Secure; SameSite=Lax',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '로그인 실패 - 잘못된 이메일 또는 비밀번호',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 형식',
  })
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

  @UsePipes(ValidationPipe)
  @Post('signup')
  @ApiOperation({
    summary: '회원가입',
    description: '새로운 사용자를 등록합니다. 이메일은 중복될 수 없습니다.',
  })
  @ApiBody({
    type: CreateLoginDto,
    description: '회원가입 정보',
  })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공',
    type: CreateLoginDto,
  })
  @ApiResponse({
    status: 409,
    description: '이미 존재하는 이메일',
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 형식 또는 유효하지 않은 데이터',
  })
  create(@Body() createUserDto: CreateLoginDto) {
    return this.loginService.signup(createUserDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('signout')
  @ApiOperation({
    summary: '로그아웃',
    description: '현재 세션을 종료하고 리프레시 토큰을 삭제합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '로그아웃 성공',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'success',
        },
      },
    },
    headers: {
      'Set-Cookie': {
        description: '리프레시 토큰 쿠키 삭제',
        schema: {
          type: 'string',
          example: 'jwt_re=; Max-Age=0; Path=/',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: '인증되지 않은 사용자',
  })
  async signOut(@Res() res, @Req() req) {
    const { jwtId } = req.user.refreshKeyData;
    await this.authService.deleteRefreshToken(jwtId);
    return res.status(201).clearCookie('jwt_re').json({ message: 'success' });
  }
}
