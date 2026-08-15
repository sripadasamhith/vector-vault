import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// T0.5: keeps the Supabase session cookie fresh on every navigation so a
// logged-in user stays logged in across reloads without an extra client
// round trip.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimization files; run everywhere else,
    // including API routes (they read the same cookie via lib/supabase/server.ts).
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
