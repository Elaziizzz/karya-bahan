import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  const isAuthenticated = request.cookies.has('auth')
  const isLoginPage = request.nextUrl.pathname === '/login'

  // If not authenticated and not on login page, redirect to login
  if (!isAuthenticated && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If authenticated and tries to go to login, redirect to dashboard
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Safeguard: Ensure store cookie is set if authenticated
  if (isAuthenticated && !request.cookies.has('store')) {
    const response = NextResponse.next()
    response.cookies.set('store', 'karya_bahan', { path: '/' })
    return response
  }
  
  return NextResponse.next()
}
 
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
