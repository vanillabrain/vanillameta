export interface JwtPayload {
  userId: string;
  email: string;
  id: number;
  authVersion?: number;
}

export interface AccessTokenPayload {
  accessKeyData: JwtPayload;
}

export interface RefreshTokenPayload {
  refreshKeyData: JwtPayload;
}
