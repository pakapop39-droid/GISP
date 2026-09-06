import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_INSFORGE_URL: z.string().url(),
  NEXT_PUBLIC_INSFORGE_ANON_KEY: z.string().min(20),
});

const serverEnvSchema = publicEnvSchema.extend({
  INSFORGE_URL: z.string().url(),
  INSFORGE_API_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function isInsForgeConfigured(): boolean {
  return publicEnvSchema.safeParse({
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  }).success;
}

export function getPublicEnv(): PublicEnv {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  });
}

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    INSFORGE_URL: process.env.INSFORGE_URL,
    INSFORGE_API_KEY: process.env.INSFORGE_API_KEY,
  });
}
