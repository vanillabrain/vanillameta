import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  UseGuards,
  Res,
  Req,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AuthService } from 'src/auth/auth.service';
import { LocalAuthGuard } from 'src/auth/guards/local-auth.guard';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { FieldSelection } from '../common/field-selection/field-selection.decorator';

@ApiTags('사용자')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @FieldSelection({
    allowedFields: ['id', 'userId', 'email', 'createdAt', 'updatedAt'],
    excludeFields: ['password', 'jwtId'],
  })
  @UseGuards(JwtAuthGuard)
  @Get('userinfo')
  @ApiOperation({ 
    summary: '사용자 정보 조회', 
    description: '현재 로그인한 사용자의 정보를 조회합니다.' 
  })
  @ApiBearerAuth('AccessToken')
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). 예: id,email,createdAt',
    example: 'id,userId,email',
  })
  @ApiOkResponse({
    description: '사용자 정보',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number' },
        userId: { type: 'string' },
        email: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  findOne(@Req() req, @Query('fields') fields?: string) {
    const { id } = req.user.accessKeyData;
    return this.userService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-info')
  @ApiOperation({ 
    summary: '사용자 정보 수정', 
    description: '사용자의 정보를 수정합니다.' 
  })
  @ApiBearerAuth('AccessToken')
  @ApiOkResponse({ 
    description: '사용자 정보가 성공적으로 수정되었습니다.' 
  })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  updateUsername(@Req() req, @Body() updateUserDto: UpdateUserDto) {
    const { userId } = req.user.accessKeyData;
    return this.userService.updateUserInfo(userId, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('delete-account')
  @ApiOperation({ 
    summary: '사용자 계정 삭제', 
    description: '사용자 계정을 영구적으로 삭제합니다. 비밀번호 확인이 필요합니다.' 
  })
  @ApiBearerAuth('AccessToken')
  @ApiOkResponse({ 
    description: '계정이 성공적으로 삭제되었습니다.' 
  })
  @ApiBadRequestResponse({ description: '비밀번호가 일치하지 않습니다.' })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  deleteUser(@Req() req, @Body() createUserDto: CreateUserDto) {
    const { userId } = req.user.accessKeyData;
    const { password } = createUserDto;
    return this.userService.deleteUser(userId, password);
  }

  @UseGuards(LocalAuthGuard)
  @Post('get-access-token')
  @ApiOperation({ 
    summary: '액세스 토큰 재발급', 
    description: '리프레시 토큰을 사용하여 새로운 액세스 토큰을 발급받습니다.' 
  })
  @ApiCreatedResponse({
    description: '액세스 토큰 재발급 성공',
    schema: {
      properties: {
        accessToken: { 
          type: 'string', 
          description: '새로운 JWT 액세스 토큰',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
        },
        message: { type: 'string', example: 'success' }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: '리프레시 토큰이 유효하지 않습니다.' })
  async reissuanceAccessToken(@Req() req, @Res() res) {
    const { userId } = req.user.refreshKeyData;
    const accessToken = await this.userService.reissuanceAccessToken(userId);
    return res.status(201).json({ accessToken: accessToken, message: 'success' });
  }

  @FieldSelection({
    allowedFields: ['id', 'title', 'description', 'createdAt', 'updatedAt'],
    excludeFields: [],
  })
  @UseGuards(JwtAuthGuard)
  @Get('get-dashboard')
  @ApiOperation({ 
    summary: '사용자 대시보드 목록 조회', 
    description: '현재 사용자가 소유한 대시보드 목록을 조회합니다.' 
  })
  @ApiBearerAuth('AccessToken')
  @ApiQuery({
    name: 'fields',
    required: false,
    description: '반환할 필드 선택 (쉼표로 구분). 예: id,title,description',
    example: 'id,title,createdAt',
  })
  @ApiOkResponse({
    description: '대시보드 목록',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          title: { type: 'string' },
          description: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: '인증 실패' })
  async findDashboardId(@Req() req, @Query('fields') fields?: string) {
    const { id } = req.headers.accessKeyData;
    return await this.userService.findDashboardId(id);
  }
}
