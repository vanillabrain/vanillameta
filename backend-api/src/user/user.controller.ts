import { Controller, Get, Post, Body, Patch, Delete, UseGuards, Res, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('user')
@ApiTags('유저 API')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('userinfo')
  @ApiOperation({ summary: '해당유저정보 가져오기' })
  findOne(@Req() req) {
    const { id } = req.user.accessKeyData;
    return this.userService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-info')
  @ApiOperation({ summary: '유저정보 수정' })
  @ApiCreatedResponse({
    description: '성공여부',
    schema: {
      example: {
        success: true,
        data: [
          {
            id: 'cea1d926-6f1b-4a37-a46c-8ddf0b17a0bc',
            user_id: 'Ryan',
            password: '1234qweR!!',
            salt: '임시',
            name: 'Ryan',
            age: 25,
            createdAt: '2021-12-25T23:30:51.371Z',
            updatedAt: '2021-12-25T23:30:51.371Z',
            deletedAt: null,
          },
        ],
      },
    },
  })
  // @ApiBearerAuth('access-token')
  updateUsername(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const { userId } = req.user.accessKeyData;
    return this.userService.updateUserInfo(userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  @ApiOperation({ summary: ' 해당유저 삭제 ' })
  deleteUser(@Req() req, @Body() createUserDto: CreateUserDto) {
    const { userId } = req.user.accessKeyData;
    const { password } = createUserDto;
    return this.userService.deleteUser(userId, password);
  }

  @UseGuards(LocalAuthGuard)
  @Post('get-access-token')
  @ApiOperation({ summary: 'AccessToken 재 발급' })
  async reissuanceAccessToken(@Req() req, @Res() res) {
    const { userId } = req.user.refreshKeyData;
    const accessToken = await this.userService.reissuanceAccessToken(userId);
    return res.status(201).json({ accessToken: accessToken, message: 'success' });
  }

  @UseGuards(JwtAuthGuard)
  @Get('get-dashboard')
  @ApiOperation({ summary: '해당유정의 대시보드 목록 가져오기' })
  async findDashboardId(@Req() req) {
    const { id } = req.headers.accessKeyData;
    await this.userService.findDashboardId(id);
  }
}
