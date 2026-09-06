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
    const { data: authData, error: authError } =
      await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json(
        { message: "กรุณาเข้าสู่ระบบอีกครั้ง" },
        { status: 401 },
      );
    }

    const { data, error } = await insforge.database.rpc(
      rpcName,
      toArguments(parsed.data),
    );
    if (error) {
      return apiError(error);
    }

    let notificationWarning: string | undefined;
    if (authData.user.email) {
      const { error: notificationError } = await insforge.database.rpc(
        "queue_current_user_notification",
        {
          type_input: rpcName.toUpperCase(),
          title_input: successMessage,
          body_input: successMessage,
          recipient_email_input: authData.user.email,
          action_url_input: null,
        },
      );
      if (notificationError) {
        notificationWarning =
          "ธุรกรรมสำเร็จ แต่สร้าง Email Job ไม่สำเร็จ ระบบต้องตรวจ Log";
      }
    }

    return NextResponse.json(
      { data, message: successMessage, notificationWarning },
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
