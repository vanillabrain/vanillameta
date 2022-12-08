import { Controller, Get, Post, Body, Patch, Param, Delete, UsePipes, ValidationPipe, Res, Req, UseGuards } from '@nestjs/common';
import { LoginService } from './login.service';
import { CreateLoginDto } from './dto/create-login.dto';
import { UpdateLoginDto } from './dto/update-login.dto';
import { LoginUserDto } from '../login/dto/login-user.dto';
import { AuthService } from 'src/auth/auth.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';

@Controller('login')
export class LoginController {
  constructor(
      private readonly loginService: LoginService,
      private readonly authService: AuthService,
  ) {}

  @UsePipes(ValidationPipe)
  @Post('signin')
  async logIn(@Res() res,@Req() req, @Body() loginDto: LoginUserDto){
    const findUser = await this.loginService.signin(loginDto)
    // 유저존재여부 확인
    const accessToken = await this.authService.generateAccessToken( findUser )
    // AccessToken발급
    const refreshToken = await this.authService.generateRefreshToken( findUser );
    // RefreshToken발급
    await this.authService.setRefreshKey(refreshToken, findUser.jwtId)
    // RefreshToken 저장

    res.cookie('jwt_re', refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true
    })
    return res.status(201).json({ accessToken: accessToken, message: 'success' })
  }
  // validationPipe = 들어오는 모든 클라이언트 페이로드에 대한 유효성 검사 규칙을 적용
  @UsePipes(ValidationPipe)
  @Post('signup')
  create(@Body() createUserDto: CreateLoginDto) {
    return this.loginService.signup(createUserDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('signout')
  async signOut(@Res() res, @Req() req) {
    const refreshToken = req.headers.cookie;
    delete req.headers.authorization;
    await this.authService.deleteRefreshToken(refreshToken)
    return res.status(201).clearCookie('jwt_re').json({ message: 'success'})
  }
}
