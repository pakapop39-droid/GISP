import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { apiError } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";

export async function runRpcRoute<TSchema extends z.ZodType>(
  request: NextRequest,
  schema: TSchema,
  rpcName: string,
  toArguments: (input: z.infer<TSchema>) => Record<string, unknown>,
  successMessage: string,
  successStatus = 200,
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "รูปแบบ JSON ไม่ถูกต้อง" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "ข้อมูลไม่ครบหรือรูปแบบไม่ถูกต้อง",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    await requireAppAccess({ active: true });
    const insforge = await createInsForgeServerClient();
    const { data, error } = await insforge.database.rpc(
      rpcName,
      toArguments(parsed.data),
    );
    if (error) {
      return apiError(error);
    }

    return NextResponse.json(
      { data, message: successMessage },
      { status: successStatus },
    );
  } catch (error) {
    return apiError(error);
  }
}

export function parseIdQuantities(input: string) {
  return input
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const [id, rawQuantity] = value.split(":");
      const quantity = rawQuantity ? Number(rawQuantity) : 1;
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ) ||
        !Number.isFinite(quantity) ||
        quantity <= 0
      ) {
        throw new Error(`รายการ "${value}" ไม่ถูกต้อง ใช้รูปแบบ UUID:จำนวน`);
      }
      return { id, quantity };
    });
}
