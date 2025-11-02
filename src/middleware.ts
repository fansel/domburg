import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, hasAdminRights } from '@/lib/auth';

const publicPaths = ['/auth/login', '/auth/reset-password', '/auth/guest', '/booking/status', '/api/bookings/check', '/book', '/calendar', '/api/auth/validate-guest-code', '/api/auth/check', '/api/auth/reset-password', '/api/auth/request-password-reset', '/api/auth/change-password', '/change-password', '/dev/emails', '/api/dev', '/locales', '/api/cleaning', '/housekeeping'];
const adminPaths = ['/admin'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Root-Page erlauben (hat eigene Weiterleitungslogik)
  if (pathname === '/') {
    return NextResponse.next();
  }
  
  // Öffentliche Pfade erlauben
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Token aus Cookie holen
  const token = request.cookies.get('auth_token')?.value;

  // Kein Token -> Login
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Token verifizieren
  const payload = await verifyToken(token);
  if (!payload) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Admin-Bereich nur für Admins (SUPERADMIN hat automatisch ADMIN-Rechte)
  if (adminPaths.some(path => pathname.startsWith(path))) {
    if (!hasAdminRights(payload.role)) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

