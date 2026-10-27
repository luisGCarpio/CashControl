import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from './app/modules/auth/session';

const PUBLIC_AUTH_ROUTES = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir recursos estáticos y rutas de autenticación públicas
  if (
    pathname.startsWith('/_next') ||
    PUBLIC_AUTH_ROUTES.has(pathname) ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const validUser = token ? await verifySessionToken(token) : null;

  // Si ya tiene sesión activa y va a login, redirigir a dashboard
  if (pathname === '/login') {
    if (validUser) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  if (!validUser) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
