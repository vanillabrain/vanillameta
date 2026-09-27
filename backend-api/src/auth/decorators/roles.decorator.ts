import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * 핸들러/컨트롤러에 필요한 역할을 지정한다. RolesGuard 와 함께 사용.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
