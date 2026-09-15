import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin"];

/**
 * Domains allowed to serve this site.
 *
 * Someone is proxying the deployment under a domain we don't control, so
 * anything arriving under an unrecognised host is refused outright — a
 * redirect would still hand them a working route to the real site.
 */
const ALLOWED_HOSTS = [
  "sweet1ne.com",
  "www.sweet1ne.com",
  // Vercel's own preview and production URLs, so deploys stay testable.
  ".vercel.app",
  // Local development.
  "localhost",
  "127.0.0.1",
];

function isAllowedHost(host: string) {
  const clean = host.split(":")[0].toLowerCase();

  return ALLOWED_HOSTS.some((allowed) =>
    allowed.startsWith(".") ? clean.endsWith(allowed) : clean === allowed
  );
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  // Temporary — the block isn't firing, so this prints what actually
  // arrives. A proxy may be forwarding its own hostname rather than passing
  // the original through, in which case the allowlist never sees the domain
  // we're trying to refuse. Read it in Vercel's Logs, then remove.
  console.log(
    JSON.stringify({
      host,
      forwardedHost: request.headers.get("x-forwarded-host"),
      // Cloudflare adds these; their presence tells us a proxy is involved.
      cfRay: request.headers.get("cf-ray"),
      cfHost: request.headers.get("cf-connecting-ip"),
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      path: request.nextUrl.pathname,
      allowed: isAllowedHost(host),
    })
  );

  // Checked before anything else — no session work, no rendering, nothing
  // for an unrecognised host.
  if (!isAllowedHost(host)) {
    return new NextResponse(null, { status: 403 });
  }

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};