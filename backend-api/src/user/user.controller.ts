import { Controller, Get, Post, Body, Patch, Delete, UseGuards, Res, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';

@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

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
  deleteUser(@Req() req, @Body() createUserDto: CreateUserDto) {
    const { authorization } = req.headers;
    const { password } = createUserDto;
    return this.userService.deleteUser(authorization, password);
  }

  // @UseGuards(JwtAuthGuard)
  @Post('get-access-token')
  async reissuanceAccessToken(@Req() req, @Res() res) {
    const { cookie } = req.headers;
    const accessToken = await this.userService.reissuanceAccessToken(cookie);
    return res.status(201).json({ accessToken: accessToken, message: 'success' });
  }

  @UseGuards(JwtAuthGuard)
  @Get('get-dashboard')
  async findDashboardId(@Req() req) {
    const { authorization } = req.headers;
    await this.userService.findDashboardId(authorization);
  }
}
