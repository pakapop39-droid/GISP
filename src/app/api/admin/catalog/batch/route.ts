import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, invalidInput } from "@/lib/api/response";
import { requireAppAccess } from "@/lib/auth/session";
import {
  catalogBatchActionSchema,
  catalogBatchPayload,
} from "@/lib/catalog/api-schema";
import {
  catalogBatchSummary,
  catalogIssuesForProduct,
  type CatalogBatchProduct,
  type CatalogBatchRow,
} from "@/lib/catalog/batch-status";
import { createInsForgeAdminClient } from "@/lib/insforge/admin";
import { createInsForgeServerClient } from "@/lib/insforge/server";

const supplierQuerySchema = z.union([z.uuid(), z.null()]);

export async function GET(request: NextRequest) {
  let loadStage = "ตรวจสิทธิ์";
  try {
    const context = await requireAppAccess({ permissions: ["catalog.read"] });
    const requestedSupplier = request.nextUrl.searchParams.get("supplierId");
    const supplierId = requestedSupplier || null;
    if (!supplierQuerySchema.safeParse(supplierId).success) return invalidInput();

    loadStage = "โหลดรายชื่อ Supplier";
    const admin = createInsForgeAdminClient();
    const supplierResult = await admin.database
      .from("suppliers")
      .select("id,code,name,status,default_currency,default_lead_time_days")
      .order("code")
      .limit(500);
    if (supplierResult.error) throw supplierResult.error;
    const suppliers = supplierResult.data ?? [];
    const selectedSupplier = supplierId
      ? suppliers.find((item) => item.id === supplierId)
      : suppliers.find((item) => item.code === "CN01") ?? suppliers[0];

    if (!selectedSupplier) {
      return NextResponse.json({
        data: {
          suppliers: [],
          selectedSupplierId: null,
          rows: [],
          summary: catalogBatchSummary([]),
          runs: [],
        },
      });
    }

    loadStage = "โหลดรายการสินค้า";
    const productResult = await admin.database
      .from("products")
      .select(
        "id,supplier_id,category_id,sku,name_th,name_en,product_type,status,qa_status,description_th,specification_summary,default_lead_time_days,width_mm,depth_mm,height_mm,material_summary,factory_cost,factory_currency",
      )
      .eq("supplier_id", selectedSupplier.id)
      .order("sku")
      .limit(1000);
    if (productResult.error) throw productResult.error;
    const products = (productResult.data ?? []) as CatalogBatchProduct[];
    const productIds = products.map((item) => item.id);

    const insforge = await createInsForgeServerClient();
    loadStage = "ตรวจ Variant รูป ต้นทุน และราคา";
    const relationResult = await insforge.database.rpc(
      "get_catalog_batch_relation_state",
      { product_ids_input: productIds },
    );
    if (relationResult.error) throw relationResult.error;
    const relationRows = (relationResult.data ?? []) as Array<{
      product_id: string;
      active_variant: boolean;
      primary_image: boolean;
      active_cost: boolean;
      active_price: boolean;
    }>;

    loadStage = "โหลดประวัติ Batch";
    const runResult = await insforge.database
      .from("catalog_batch_runs")
      .select(
        "id,action,requested_count,succeeded_count,skipped_count,failed_count,status,created_at,completed_at",
      )
      .order("created_at", { ascending: false })
      .limit(12);
    if (runResult.error) throw runResult.error;

    loadStage = "สรุปผล Validation";
    const activeVariants = new Set(
      relationRows
        .filter((item) => item.active_variant)
        .map((item) => String(item.product_id)),
    );
    const primaryImages = new Set(
      relationRows
        .filter((item) => item.primary_image)
        .map((item) => String(item.product_id)),
    );
    const activeCosts = new Set(
      relationRows
        .filter((item) => item.active_cost)
        .map((item) => String(item.product_id)),
    );
    const activePrices = new Set(
      relationRows
        .filter((item) => item.active_price)
        .map((item) => String(item.product_id)),
    );
    const supplierActive = selectedSupplier.status === "ACTIVE";
    const canReadCost = context.permissions.includes("catalog.cost.read");

    const rows: CatalogBatchRow[] = products.map((product) => {
      const relations = {
        supplierActive,
        activeVariant: activeVariants.has(product.id),
        primaryImage: primaryImages.has(product.id),
        activeCost: activeCosts.has(product.id),
        activePrice: activePrices.has(product.id),
      };
      return {
        ...product,
        factory_cost: canReadCost ? product.factory_cost : null,
        factory_currency: canReadCost ? product.factory_currency : null,
        sourceCostReady:
          canReadCost && Number(product.factory_cost ?? 0) > 0,
        ...relations,
        issues: catalogIssuesForProduct(product, relations),
      };
    });

    return NextResponse.json({
      data: {
        suppliers,
        selectedSupplierId: selectedSupplier.id,
        rows,
        summary: catalogBatchSummary(rows),
        runs: runResult.data ?? [],
      },
    });
  } catch (error) {
    const response = apiError(error);
    if (response.status < 500) return response;
    console.error("catalog batch load failed", { loadStage, error });
    return NextResponse.json(
      {
        code: "BATCH_LOAD_FAILED",
        message: `โหลดข้อมูลไม่สำเร็จในขั้น “${loadStage}” กรุณาลองใหม่`,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const parsed = catalogBatchActionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalidInput(parsed.error.flatten().fieldErrors);

  try {
    const requiredPermission =
      parsed.data.action === "PREPARE_COSTS"
        ? "catalog.cost.manage"
        : parsed.data.action === "ACTIVATE_MEMBER_PRICES"
          ? "catalog.formula.manage"
          : "catalog.manage";
    await requireAppAccess({ permissions: [requiredPermission] });
    const insforge = await createInsForgeServerClient();
    const uniqueProductIds = [...new Set(parsed.data.productIds)];
    const { data, error } = await insforge.database.rpc("run_catalog_batch", {
      action_input: parsed.data.action,
      product_ids_input: uniqueProductIds,
      payload_input: catalogBatchPayload(parsed.data),
    });
    if (error) throw error;

    const actionMessages = {
      FILL_LEAD_TIME: "เติม Lead time ให้รายการที่ยังว่างแล้ว",
      FILL_MATERIAL: "เติมข้อมูลวัสดุให้รายการที่ยังว่างแล้ว",
      CREATE_DEFAULT_VARIANTS: "สร้าง Default Variant จากข้อมูลที่ครบแล้ว",
      PREPARE_COSTS: "สร้างต้นทุนเวอร์ชันผ่าน Pricing Engine แล้ว",
      ACTIVATE_MEMBER_PRICES: "คำนวณและเปิดใช้ราคาสมาชิกแล้ว",
    } as const;
    return NextResponse.json({
      data,
      message: actionMessages[parsed.data.action],
    });
  } catch (error) {
    return apiError(error);
  }
}
