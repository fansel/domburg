import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';

const publicPaths = ['/auth/login', '/auth/verify', '/auth/guest', '/booking/status', '/api/bookings/check', '/book', '/api/auth/validate-guest-code', '/api/auth/check', '/dev/emails', '/api/dev', '/locales'];
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

  // Admin-Bereich nur für Admins
  if (adminPaths.some(path => pathname.startsWith(path))) {
    if (payload.role !== 'ADMIN') {
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

