import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UsePipes, ValidationPipe, Res, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';

@Controller('user')
export class UserController {
  constructor( private readonly userService: UserService,
               private authService: AuthService) {}

  @Post('signin')
  async logIn(@Res() res,@Req() req, @Body() loginDto: UpdateUserDto){
    const findUser = await this.userService.signin(loginDto)
    const accessToken = await this.authService.generateAccessToken( findUser );
    const refreshToken = await this.authService.generateRefreshToken( findUser.user_id );
    await this.authService.setRefreshKey(refreshToken, findUser.user_id)

    res.cookie('jwt_re', refreshToken, {
      httpOnly: true,
      sameSite: 'none',
      secure: true
    })
    return res.status(201).json({ accessToken: accessToken, message: 'success' })
  }
  // validationPipe에 더 찾아볼 것
  @UsePipes(ValidationPipe)
  @Post('signup')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.signup(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('signout')
  async signOut(@Res() res, @Req() req) {
    const refreshToken = req.headers.cookie;
    await this.authService.deleteRefreshToken(refreshToken)
    return res
        .status(205)
        .clearCookie('jwt_re')
        .json({ message: 'success'})
  }

  @UseGuards(JwtAuthGuard)
  @Get('userinfo')
  findOne(@Req() req) {
    const { authorization } = req.headers;
    return this.userService.findOne(authorization);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-info')
  updateUsername(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const { authorization } = req.headers;
    return this.userService.updateUserInfo(authorization, updateUserDto);
  }


  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  deleteUser(@Req() req, @Body() createUserDto:CreateUserDto) {
    const { authorization } = req.headers;
    const { password } = createUserDto;
    return this.userService.deleteUser( authorization, password);
  }

  @UseGuards(JwtAuthGuard)
  @Post('share/:dashboard_id')
  checkShareUrl(@Req() req, @Param() params) {
    const { authorization } = req.headers;
    const { dashboard_id } = params;
    return this.userService.checkShareUrl( authorization, dashboard_id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('get-access-token')
  async reissuanceAccessToken(@Req() req) {
    const { cookie } = req.headers;
    const accessToken = await this.userService.reissuanceAccessToken(cookie)
    return { accessToken: accessToken, message: 'success' }
  }
}
