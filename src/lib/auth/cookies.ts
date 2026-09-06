export const APP_SESSION_COOKIE = "gisp_app_session";

export const secureAuthCookieOptions = {
  options: {
    accessToken: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
    refreshToken: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    },
  },
};
