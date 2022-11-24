import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserInfo } from './entities/user-info.entity';
import { User } from './entities/user.entity.js';

@Injectable()
export class UserService {
  constructor(
  @InjectRepository(UserInfo) private readonly userInfoRepository: Repository<UserInfo>,
  @InjectRepository(User) private readonly userRepository: Repository<User>,
  private authService: AuthService,
  ) {}

  async signin( loginDto: UpdateUserDto ) {
    const { user_id, password } = loginDto;
    const findUser = await this.authService.validateUser(user_id, password);
    if (!findUser) {
      throw new UnauthorizedException(`Unauthorized`);
    }
    return findUser
  }

  async signup(createUserDto: CreateUserDto) {
    const userInfoId = await this.userInfoRepository.findOne({
      where: { email: createUserDto.email }
    });
    const userInfoEmail = await this.userInfoRepository.findOne({
      where: { user_id: createUserDto.user_id }
    })
    if(!userInfoId && !userInfoEmail){
      const { email, password, user_id } = createUserDto;
      const createUserInfo = await this.userInfoRepository.save({
        email: email,
        password: password,
        user_id: user_id
      });
      await this.userRepository.save({ user_info_id: createUserInfo.id});

      return 'success';
      // return 값으로 email, user_id 중복 데이터 나눠서 보내줘야하지 않을까?
    }
    return 'conflict'
  }

  async findOne(updateUserDto) {
    const userData = await this.userInfoRepository.findOne({
      where: { user_id: updateUserDto.user_id }
    });
    if(!userData){
      return null
    } else {
      delete userData.password;
      return userData
    }
  }

  async updatePassword(id: number, updateUserDto: UpdateUserDto) {
    const updateData = await this.userInfoRepository.findOne({ where: { id: id }});
    if(!updateData){
      return 'not exist user';
    } else {
      updateData.password = String(updateUserDto.password);
      await this.userInfoRepository.save(updateData)
      return `This action update_password a #${id} user`;
    }
  }

  async updateUsername(id: number, updateUserDto: UpdateUserDto) {
    const updateData = await this.userInfoRepository.findOne({ where: { id: id }});
    if(!updateData){
      return 'not exist user';
    } else {
      updateData.user_id = String(updateUserDto.user_id);
      await this.userInfoRepository.save(updateData)
      return `This action update_name a #${id} user`;
    }
  }

  async deleteUser(id: number) {
    const findUser = await this.userInfoRepository.findOne({
      where: { id: id }
    });
    if(!findUser){
      return 'not exist user'
    } else {
      await this.userInfoRepository.delete(findUser.id)
      return `This action removes a #${id} user`;
    }
  }

}
