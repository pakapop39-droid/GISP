import { z } from "zod";

export type CatalogTab = "suppliers" | "products" | "pricing";

export function resolveCatalogNavigation(query: { productId?: string; tab?: string }) {
  return {
    initialProductId: z.uuid().safeParse(query.productId).success ? query.productId! : "",
    initialTab: query.tab === "pricing" ? "pricing" as const : "suppliers" as const,
  };
}

export function resolveCatalogProductSelection(preferredProductId: string, products: Array<{ id: string }>) {
  return products.some((product) => product.id === preferredProductId) ? preferredProductId : products[0]?.id ?? "";
}
