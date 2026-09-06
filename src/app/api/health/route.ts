import { NextResponse } from "next/server";
import { isInsForgeConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    appMode: process.env.APP_MODE ?? "application",
    environment: process.env.NODE_ENV,
    insforge: {
      configured: isInsForgeConfigured(),
      publicUrlPresent: Boolean(process.env.NEXT_PUBLIC_INSFORGE_URL),
      anonKeyPresent: Boolean(process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY),
      serverUrlPresent: Boolean(process.env.INSFORGE_URL),
      apiKeyPresent: Boolean(process.env.INSFORGE_API_KEY),
    },
  });
}
