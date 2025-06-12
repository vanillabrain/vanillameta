export interface ApiResponse<T = any> {
  status: 'SUCCESS' | 'ERROR';
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  totalCount: number;
  page: number;
  limit: number;
}

export interface ApiError {
  status: 'ERROR';
  message: string;
  error?: string;
  statusCode?: number;
}