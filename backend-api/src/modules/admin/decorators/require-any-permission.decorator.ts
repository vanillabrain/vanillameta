import { SetMetadata } from '@nestjs/common';

export const ANY_PERMISSIONS_KEY = 'anyPermissions';
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);