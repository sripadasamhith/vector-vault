// Used only by the root middleware.ts to refresh the session cookie on every
// request (T0.5). Not a fourth Supabase client per ARCHITECTURE.md §1 — it's
// a thin wrapper around the same server-client pattern, scoped to the
// middleware's request/response cookie API instead of next/headers.
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touching auth.getUser() is what actually refreshes the token and
  // rewrites the cookie when it's near expiry. Do not remove this call even
  // though the return value is unused here.
  await supabase.auth.getUser();

  return response;
}
