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
    const accessToken = await this.authService.generateAccessToken( findUser.user_id );
    const refreshToken = await this.authService.generateRefreshToken( findUser.user_id );
    await this.authService.setRefreshKey(refreshToken, findUser.user_id)

    res.cookie('jwt_re', refreshToken, {
      httpOnly: true,
      saemSite: 'none',
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
    const refreshToken = req.headers.authorization;
    await this.authService.deleteRefreshToken(refreshToken)
    return res
        .status(205)
        .clearCookie('jwt_re')
        .json({ message: 'success'})
  }

  @UseGuards(JwtAuthGuard)
  @Get('userinfo')
  findOne(@Body() updateUserDto: UpdateUserDto) {
    return this.userService.findOne(updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  updatePassword(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updatePassword(+id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-username')
  updateUsername(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUsername(+id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete/:id')
  deleteUser(@Param('id') id: string) {
    return this.userService.deleteUser(+id);
  }
}
