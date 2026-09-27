import { IsIn, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../common/enum/role.enum';

export class UpdateRoleDto {
  @IsNotEmpty()
  @IsIn([UserRole.USER, UserRole.ADMIN])
  @ApiProperty({ enum: [UserRole.USER, UserRole.ADMIN], description: '변경할 역할' })
  role: string;
}
