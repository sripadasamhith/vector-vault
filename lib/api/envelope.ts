// Every API route returns one of these (ARCHITECTURE.md §3). No bare
// objects, no thrown strings — routes call ok()/fail() and return that.
// Written now as part of T0.6 (dashboard needs it); this is T1.1's file.

import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'conflict'
  | 'nothing_staged'
  | 'cannot_merge';

export type ApiResponse<T> =
  | { data: T }
  | { error: { code: ApiErrorCode; message: string; hint?: string } };

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  conflict: 409,
  nothing_staged: 409,
  cannot_merge: 409,
};

export function ok<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ data }, typeof init === 'number' ? { status: init } : init);
}

export function fail(
  code: ApiErrorCode,
  message: string,
  hint?: string
): NextResponse<ApiResponse<never>> {
  return NextResponse.json<ApiResponse<never>>(
    { error: { code, message, ...(hint ? { hint } : {}) } },
    { status: STATUS_BY_CODE[code] }
  );
}
