export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface JwtPayload {
  sub: string;
  email: string;
  sid: string;
  type: 'access' | 'refresh';
}
