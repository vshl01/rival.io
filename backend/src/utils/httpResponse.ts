import type { Response } from 'express';

/** Consistent success envelope: `{ data, meta? }`. */
export function ok<T>(res: Response, data: T, status = 200, meta?: unknown) {
  return res.status(status).json(meta === undefined ? { data } : { data, meta });
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function buildPageMeta(page: number, pageSize: number, total: number): PageMeta {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
