// proxy.ts
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STAFF_TABLE } from "@/lib/supabase/client";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

// Routes reachable by ANY logged-in staff member regardless of role/home page
// (e.g. clicking "View Profile" from either the HOD or staff dashboard).
const SHARED_STAFF_PATHS = ["/dashboard/student", "/dashboard/settings", "/dashboard/classes"];

// Sub-routes under /dashboard/staff that are HOD-only. Even though a plain
// staff member's home prefix is "/dashboard/staff", these must stay blocked.
const HOD_ONLY_STAFF_SUBPATHS = ["/dashboard/staff/staff-detail", "/dashboard/staff/students"];

// How long we trust a cached role before re-checking the staff table.
// Short enough that role changes/removals take effect quickly, long enough
// to kill the DB round-trip on almost every click.
const ROLE_CACHE_MAX_AGE_SECONDS = 60;
const ROLE_CACHE_COOKIE = "sb-staff-role";

function homePathForRole(role: string | null | undefined) {
  return role === "HOD" ? "/dashboard/staff" : "/dashboard/staff";
}

// Paths a staff member with this role is allowed to be on without getting
// redirected back to their home dashboard.
function allowedPrefixesForRole(role: string | null | undefined) {
  const home = homePathForRole(role);

  if (role === "HOD") {
    // Matches the HOD sidebar links: Dashboard, All Students, Staff
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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getClaims() verifies the JWT locally (cached JWKS lookup) instead of
  // calling the Supabase Auth server on every single request the way
  // getUser() does. This is the single biggest cost in this file — swap
  // it back to getUser() only if you're on an old project using symmetric
  // (HS256) JWT signing keys, where getClaims() can't verify locally.
  const {
    data: claimsData,
  } = await supabase.auth.getClaims();

  const user = claimsData?.claims
    ? { email: claimsData.claims.email as string | undefined }
    : null;

  const path = request.nextUrl.pathname;

  const onAuthPage = path === "/login" || path === "/register";
  const onDashboard = path.startsWith("/dashboard");

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

    // User is in staff -> home route depends on role (HOD vs everyone else)
    const home = homePathForRole(role);
    const allowedPrefixes = allowedPrefixesForRole(role);

    if (onAuthPage) {
      return NextResponse.redirect(new URL(home, request.url));
    }

    const isAllowed = allowedPrefixes.some((prefix) => path.startsWith(prefix));

    // Block non-HOD staff from HOD-only sub-routes, even though they fall
    // under the "/dashboard/staff" prefix that staff are otherwise allowed on.
    const isHodOnlySubpath = HOD_ONLY_STAFF_SUBPATHS.some((prefix) => path.startsWith(prefix));
    const isBlockedForRole = role !== "HOD" && isHodOnlySubpath;

    if (onDashboard && (!isAllowed || isBlockedForRole)) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/register"],
};