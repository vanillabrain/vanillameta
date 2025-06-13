import { Controller, Get, Post, Body, Patch, Delete, UseGuards, Res, Req, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger';
import { FieldSelection } from '../common/field-selection/field-selection.decorator';

@Controller('user')
@ApiTags('유저 API')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @FieldSelection({
    allowedFields: ['id', 'userId', 'email', 'createdAt', 'updatedAt'],
    excludeFields: ['password', 'jwtId']
  })
  @UseGuards(JwtAuthGuard)
  @Get('userinfo')
  @ApiOperation({ summary: '해당유저정보 가져오기' })
  @ApiBearerAuth('AccessKey')
  @ApiQuery({ 
    name: 'fields', 
    required: false, 
    description: '반환할 필드 선택 (쉼표로 구분). 예: id,email,createdAt',
    example: 'id,userId,email'
  })
  findOne(@Req() req, @Query('fields') fields?: string) {
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

  @FieldSelection({
    allowedFields: ['id', 'title', 'description', 'createdAt', 'updatedAt'],
    excludeFields: []
  })
  @UseGuards(JwtAuthGuard)
  @Get('get-dashboard')
  @ApiOperation({ summary: '해당유정의 대시보드 목록 가져오기' })
  @ApiBearerAuth('AccessKey')
  @ApiQuery({ 
    name: 'fields', 
    required: false, 
    description: '반환할 필드 선택 (쉼표로 구분). 예: id,title,description',
    example: 'id,title,createdAt'
  })
  async findDashboardId(@Req() req, @Query('fields') fields?: string) {
    const { id } = req.headers.accessKeyData;
    return await this.userService.findDashboardId(id);
  }
}
