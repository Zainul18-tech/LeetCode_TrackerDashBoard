// proxy.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STAFF_TABLE } from "@/lib/supabase/client";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

// Roles that get full HOD-equivalent access (sidebar links, HOD-only
// sub-routes, etc). Add any future "admin-tier" roles here.
const HOD_EQUIVALENT_ROLES = ["HOD", "Dean"];

function isHodEquivalent(role: string | null | undefined) {
  return !!role && HOD_EQUIVALENT_ROLES.includes(role);
}

// Routes reachable by ANY logged-in staff member regardless of role/home page
// (e.g. clicking "View Profile" from either the HOD/Dean or staff dashboard).
const SHARED_STAFF_PATHS = ["/dashboard/student", "/dashboard/settings", "/dashboard/classes"];

// Sub-routes under /dashboard/staff that are HOD/Dean-only. Even though a
// plain staff member's home prefix is "/dashboard/staff", these must stay
// blocked for anyone who isn't HOD-equivalent.
const HOD_ONLY_STAFF_SUBPATHS = ["/dashboard/staff/staff-detail", "/dashboard/staff/students"];

// How long we trust a cached role before re-checking the staff table.
// Short enough that role changes/removals take effect quickly, long enough
// to kill the DB round-trip on almost every click.
const ROLE_CACHE_MAX_AGE_SECONDS = 60;
const ROLE_CACHE_COOKIE = "sb-staff-role";

// Anything matching this never needs Supabase, cookies, or DB work.
// Checked before the client is created so these requests pay ~0ms.
const STATIC_ASSET_RE =
  /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|txt|xml|json)$/i;

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.ico" ||
    STATIC_ASSET_RE.test(pathname)
  );
}

function homePathForRole(_role: string | null | undefined) {
  // Both role tiers currently land on the same home route; kept as a
  // function (rather than a constant) so per-role home pages are a
  // one-line change later.
  return "/dashboard/staff";
}

// Paths a staff member with this role is allowed to be on without getting
// redirected back to their home dashboard.
function allowedPrefixesForRole(role: string | null | undefined) {
  const home = homePathForRole(role);

  if (isHodEquivalent(role)) {
    // Matches the HOD/Dean sidebar links: Dashboard, All Students, Staff
    return [home, "/dashboard/students", "/dashboard/staff", ...SHARED_STAFF_PATHS];
  }

  return [home, ...SHARED_STAFF_PATHS];
}

type CachedRole = {
  email: string;
  role: string | null;
  staffId: string;
};

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // --- Requirement 2: ultra-fast bypass for static assets -----------------
  // No Supabase client, no cookie parsing, no auth check — just pass through.
  // (config.matcher below already excludes most of these; this is a second,
  // even cheaper guard for anything that slips through, e.g. /public files
  // referenced from within /dashboard.)
  if (isStaticAsset(path)) {
    return NextResponse.next();
  }

  const onAuthPage = path === "/login" || path === "/register";
  const onDashboard = path.startsWith("/dashboard");

  // --- Requirement 3: skip Supabase entirely on paths that don't need it --
  // Only /dashboard/* and /login /register (per the matcher) ever reach
  // this point, and both of those DO need an auth check, so there is no
  // further "public path" branch to add here without changing the matcher.
  // The guard is still made explicit so future public routes added to the
  // matcher don't silently start paying for a Supabase round-trip.
  if (!onDashboard && !onAuthPage) {
    return NextResponse.next();
  }

  // --- Requirement 1: correct cookie sync ----------------------------------
  // `response` must be reassigned INSIDE setAll so it carries the request
  // object with the newly-set cookies already applied to it. Writing the
  // cookies to `request.cookies` first (so subsequent Supabase calls in this
  // same invocation see them) and then to the fresh `response` (so the
  // browser receives them) is what stops the refresh token from being
  // dropped between requests.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getUser() (not getClaims()) is required here: it's the call that
  // actually talks to the Supabase Auth server and rotates/refreshes the
  // session, which is what triggers setAll() above and keeps the refresh
  // token cookie in sync. getClaims() only verifies a JWT locally — it never
  // refreshes, so an expiring/rotated refresh token cookie never gets
  // rewritten and eventually goes stale, producing
  // "Refresh Token Not Found". The cost is one Auth-server round trip, but
  // it's now only paid on the /dashboard and /login /register paths that
  // reach this line, not on every request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in -> protect dashboard
  if (!user && onDashboard) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user?.email) {
    let role: string | null = null;

    // Try the cached role cookie first to skip the staff-table query.
    const cachedRaw = request.cookies.get(ROLE_CACHE_COOKIE)?.value;
    let cached: CachedRole | null = null;

    if (cachedRaw) {
      try {
        cached = JSON.parse(cachedRaw) as CachedRole;
      } catch {
        cached = null;
      }
    }

    if (cached && cached.email === user.email) {
      role = cached.role;
    } else {
      // Cache miss (first request, expired, or different user) -> hit the DB.
      const { data: profile } = await supabase
        .from(STAFF_TABLE)
        .select("id, role")
        .eq("email", user.email)
        .maybeSingle();

      if (!profile) {
        // User is not in staff -> not authorized for the dashboard
        if (onDashboard) {
          return NextResponse.redirect(new URL("/login", request.url));
        }
        return response;
      }

      role = profile.role;

      response.cookies.set(
        ROLE_CACHE_COOKIE,
        JSON.stringify({ email: user.email, role, staffId: profile.id }),
        {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: ROLE_CACHE_MAX_AGE_SECONDS,
          path: "/",
        }
      );
    }

    // User is in staff -> home route depends on role (HOD/Dean vs everyone else)
    const home = homePathForRole(role);
    const allowedPrefixes = allowedPrefixesForRole(role);

    if (onAuthPage) {
      return NextResponse.redirect(new URL(home, request.url));
    }

    const isAllowed = allowedPrefixes.some((prefix) => path.startsWith(prefix));

    // Block non-HOD/Dean staff from HOD/Dean-only sub-routes, even though
    // they fall under the "/dashboard/staff" prefix that staff are
    // otherwise allowed on.
    const isHodOnlySubpath = HOD_ONLY_STAFF_SUBPATHS.some((prefix) => path.startsWith(prefix));
    const isBlockedForRole = !isHodEquivalent(role) && isHodOnlySubpath;

    if (onDashboard && (!isAllowed || isBlockedForRole)) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return response;
}

export const config = {
  // Excludes _next static/image assets and common file extensions up front,
  // so the vast majority of static requests never even invoke this function.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)",
    "/dashboard/:path*",
    "/login",
    "/register",
  ],
};