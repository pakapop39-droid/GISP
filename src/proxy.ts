import { updateSession } from "@insforge/sdk/ssr/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { secureAuthCookieOptions } from "@/lib/auth/cookies";
import { APP_SESSION_COOKIE } from "@/lib/auth/cookies";
import { isPendingProductionFeature, isReleaseAEnabled, isReleaseAPathAllowed } from "@/lib/release-stage";

const publicPaths = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/member-guide.html",
  "/demo",
  "/v1-3",
  "/v1-4",
  "/api/auth",
  "/api/health",
  "/api/public/catalogs",
  "/api/internal/notifications/process",
  "/catalog/share",
  "/_next",
  "/icon.svg",
  "/favicon.ico",
  "/demo-assets",
  "/demo-documents",
];

export async function proxy(request: NextRequest) {
  if (process.env.APP_MODE === "demo") {
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith("/api/") && pathname !== "/api/health") {
      return new NextResponse(null, { status: 404 });
    }

    const allowed =
      pathname === "/" ||
      pathname === "/demo" ||
      pathname === "/v1-3" ||
      pathname.startsWith("/v1-3/") ||
      pathname === "/v1-4" ||
      pathname.startsWith("/v1-4/") ||
      pathname === "/member-guide.html" ||
      pathname === "/api/health" ||
      pathname.startsWith("/demo-documents/") ||
      pathname.startsWith("/demo-assets/") ||
      pathname.startsWith("/_next/") ||
      pathname === "/favicon.ico" ||
      pathname === "/icon.svg";

    if (!allowed) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    return NextResponse.next();
  }

  if (isPendingProductionFeature(request.nextUrl.pathname) ||
      (isReleaseAEnabled() && !isReleaseAPathAllowed(request.nextUrl.pathname, process.env.ENABLE_STAFF_OPERATIONS === "true"))) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { code: "RELEASE_NOT_ENABLED", message: "ฟังก์ชันนี้ยังไม่เปิดใช้งานใน Production รุ่นปัจจุบัน" },
        { status: 404 },
      );
    }
    return new NextResponse(null, { status: 404 });
  }
  const response = NextResponse.next({ request });
  const configured =
    Boolean(process.env.NEXT_PUBLIC_INSFORGE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY);
  let accessToken: string | null = null;

  if (configured) {
    type SessionOptions = Parameters<typeof updateSession>[0];
    const session = await updateSession({
      requestCookies:
        request.cookies as unknown as SessionOptions["requestCookies"],
      responseCookies: response.cookies,
      ...secureAuthCookieOptions,
    });
    accessToken = session.accessToken;
  }

  const isPublic = publicPaths.some(
    (path) =>
      request.nextUrl.pathname === path ||
      request.nextUrl.pathname.startsWith(`${path}/`),
  );
  const hasSession = Boolean(
    accessToken && request.cookies.get(APP_SESSION_COOKIE)?.value,
  );

  if (!isPublic && configured && !hasSession) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบอีกครั้ง" },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
