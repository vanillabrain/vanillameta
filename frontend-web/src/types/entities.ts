export interface BaseEntity {
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  userId: string;
  email: string;
  password?: string; // 보안상 프론트엔드에서는 선택적
  jwtId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Dashboard extends BaseEntity {
  id: number;
  title: string;
  templateId?: number;
  layout?: string;
  seq?: number;
  shareId?: number;
  delYn?: string;
  shareYn?: string;
  uuid?: string;
  endDate?: string;
}

export interface Database extends BaseEntity {
  id: number;
  name: string;
  description?: string;
  connectionConfig: string; // JSON 문자열
  engine: string;
  type: string;
  timezone?: string;
  icon?: string; // 프론트엔드에서 추가
}

export interface Dataset extends BaseEntity {
  id: number;
  title?: string;
  databaseId: number;
  query: string;
}

export interface Widget extends BaseEntity {
  id: number;
  title?: string;
  description?: string;
  componentId: number;
  datasetType: 'TABLE' | 'DATASET';
  datasetId: number;
  option: string; // JSON 문자열
  delYn?: string;
}

export interface Component extends BaseEntity {
  id: number;
  type: string;
  title: string;
  description?: string;
  category?: string;
  option: string; // JSON 문자열
  icon?: string;
  seq?: number;
  useYn?: string;
}

export interface DatabaseType {
  id: number;
  type: string;
  title: string;
  description?: string;
  useYn?: string;
  icon?: string;
}

export interface Template extends BaseEntity {
  id: number;
  title: string;
  description?: string;
  category?: string;
  option: string; // JSON 문자열
  useYn?: string;
}

export interface TemplateItem extends BaseEntity {
  id: number;
  templateId: number;
  title: string;
  description?: string;
  option: string; // JSON 문자열
  seq?: number;
}

export interface ShareUrl extends BaseEntity {
  id: number;
  dashboardId: number;
  uuid: string;
  shareYn: string;
  expiredAt?: string;
}