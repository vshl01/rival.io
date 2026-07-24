import { NextRequest, NextResponse } from 'next/server';

// The API also serves uploaded attachments, so it needs to be allowed for both
// XHR (connect-src) and images (img-src).
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').origin;
  } catch {
    return '';
  }
})();

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    `default-src 'self'`,
    // 'strict-dynamic' lets the nonced Next bootstrap load its own chunks
    // without whitelisting the whole origin.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Next and Tailwind inject inline <style>; style injection is not an
    // XSS vector worth blocking here.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${apiOrigin}`,
    `font-src 'self'`,
    `connect-src 'self' ${apiOrigin}${isDev ? ' ws: wss:' : ''}`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    ...(isDev ? [] : [`upgrade-insecure-requests`]),
  ]
    .join('; ')
    .replace(/\s{2,}/g, ' ');

  // Next reads the nonce off the request CSP header and stamps it onto the
  // scripts it renders, so no changes are needed in layout.tsx.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
