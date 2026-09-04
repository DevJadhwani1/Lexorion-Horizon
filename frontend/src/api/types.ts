export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) { super(message); this.name = "ApiError"; }
}
export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number; sort: string; direction: string; }
