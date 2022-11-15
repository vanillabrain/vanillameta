import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UsePipes, ValidationPipe, Res } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';


@Controller('user')
export class UserController {
  constructor( private readonly userService: UserService,
               private authService: AuthService) {}


  @Post('signin')
  async login(@Res() res, @Body() loginDto: UpdateUserDto){

    const findUser = await this.userService.signin(loginDto)
    const accessToken = await this.authService.generateAccessToken( findUser.email );
    const refreshToken = await this.authService.generateRefreshToken( findUser.email );

    res.cookie('jwt_ac', accessToken, {
      httpOnly: true,
      saemSite: 'none',
      secure: true
    });
    res.cookie('jwt_re', refreshToken, {
      httpOnly: true,
      saemSite: 'none',
      secure: true
    })
    return res.status(201).send('ok')
  }

  @UsePipes(ValidationPipe)
  @Post('signup')
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('userinfo/:email')
  findOne(@Param('email') email: string) {
    return this.userService.findOne(email);
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
