// Old WordPress addresses that have no page on the new site answer "410 Gone", so Google drops them
// quickly instead of retrying. The two documents that lived in the WordPress media library are sent
// to their new home on the downloads page. Every other address is served straight from the static files.
export const config = {
  matcher: [
    '/wp-admin/:path*', '/wp-content/:path*', '/wp-includes/:path*', '/wp-json/:path*',
    '/xmlrpc.php', '/wp-login.php', '/feed/:path*', '/comments/feed/:path*',
    '/author/:path*', '/category/:path*', '/tag/:path*', '/page/:path*', '/sample-page',
  ],
};

export default function middleware(request) {
  const path = new URL(request.url).pathname.toLowerCase();
  if (path.startsWith('/wp-content/uploads/')) {
    if (path.endsWith('.pdf') && /iso|9001|cert/.test(path)) {
      return Response.redirect(new URL('/downloads/ertone-iso-9001-certificate.pdf', request.url), 301);
    }
    if (/\.(docx?|pdf)$/.test(path) && /terms|conditions|t-c|tandc/.test(path)) {
      return Response.redirect(new URL('/downloads/ertone-terms-and-conditions.docx', request.url), 301);
    }
    if (/brochure/.test(path)) {
      return Response.redirect(new URL('/downloads', request.url), 301);
    }
  }
  return new Response('Gone', { status: 410, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' } });
}
