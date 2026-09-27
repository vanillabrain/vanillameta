import { Controller, Get, Post, Body, Patch, Delete, UseGuards, Res, Req } from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';
import { ApiBearerAuth,  ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('user')
@ApiTags('유저 API')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('userinfo')
  @ApiOperation({ summary: '해당유저정보 가져오기' })
  @ApiBearerAuth('AccessKey')
  findOne(@Req() req) {
    const { id } = req.user.accessKeyData;
    return this.userService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-info')
  @ApiOperation({ summary: '유저정보 수정' })
  @ApiBearerAuth('AccessKey')
  updateUsername(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const { userId } = req.user.accessKeyData;
    return this.userService.updateUserInfo(userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  @ApiOperation({ summary: ' 해당유저 삭제 ' })
  @ApiBearerAuth('AccessKey')
  deleteUser(@Req() req, @Body() deleteAccountDto: DeleteAccountDto) {
    const { userId } = req.user.accessKeyData;
    const { password } = deleteAccountDto;
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
  @ApiBearerAuth('AccessKey')
  async findDashboardId(@Req() req) {
    const { id } = req.headers.accessKeyData;
    await this.userService.findDashboardId(id);
  }
}
