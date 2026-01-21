export interface JwtPayload {
  userId: string;
  email: string;
  id: number;
}

export interface AccessTokenPayload {
  accessKeyData: JwtPayload;
}

export interface RefreshTokenPayload {
  refreshKeyData: JwtPayload;
}
