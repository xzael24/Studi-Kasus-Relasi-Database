export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  message: string | string[];
  error: string;
  statusCode: number;
}

export function successResponse<T>(
  message: string,
  data?: T,
): ApiResponse<T> {
  return { success: true, message, ...(data !== undefined ? { data } : {}) };
}

export function paginatedResponse<T>(
  message: string,
  data: T[],
  page: number,
  limit: number,
  total: number,
): ApiResponse<T[]> {
  return {
    success: true,
    message,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
