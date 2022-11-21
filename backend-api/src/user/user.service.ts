import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
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


  async create(createUserDto: CreateUserDto) {
    const userInfo = await this.userRepository.findOne({
      where: { email: createUserDto.email }
    });
    if(!userInfo){
      const { email, password, user_id } = createUserDto;
      await this.userRepository.save({
        email: email,
        password: password,
        user_name: user_id
      });
      return 'success';
    }
    return 'conflict'
  }

  async findOne(email: string) {
    const userData = await this.userRepository.findOne({
      where: { email: email }
    });
    if(!userData){
      return null
    } else {
      delete userData.password;
      return userData
    }
  }

  async updatePassword(id: number, updateUserDto: UpdateUserDto) {
    const updateData = await this.userRepository.findOne({ where: { id: id }});
    if(!updateData){
      return 'not exist user';
    } else {
      updateData.password = String(updateUserDto.password);
      await this.userRepository.save(updateData)
      return `This action update_password a #${id} user`;
    }
  }

  async updateUsername(id: number, updateUserDto: UpdateUserDto) {
    const updateData = await this.userRepository.findOne({ where: { id: id }});
    if(!updateData){
      return 'not exist user';
    } else {
      updateData.user_id = String(updateUserDto.user_id);
      await this.userRepository.save(updateData)
      return `This action update_name a #${id} user`;
    }
  }

  async deleteUser(id: number) {
    const findUser = await this.userRepository.findOne({
      where: { id: id }
    });
    if(!findUser){
      return 'not exist user'
    } else {
      await this.userRepository.delete(findUser.id)
      return `This action removes a #${id} user`;
    }
  }
}
