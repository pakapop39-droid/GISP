export const sharedCatalogPriceModes = ["HIDDEN", "CUSTOM"] as const;
export type SharedCatalogPriceMode = (typeof sharedCatalogPriceModes)[number];

export const sharedCatalogStatuses = ["DRAFT", "PUBLISHED", "REVOKED"] as const;
export type SharedCatalogStatus = (typeof sharedCatalogStatuses)[number];

export const sharedCatalogScopes = ["CURATED", "PRODUCT", "PROJECT", "FULL_CATALOG"] as const;
export type SharedCatalogScope = (typeof sharedCatalogScopes)[number];

export type SharedCatalogRow = {
  id: string;
  title: string;
  introduction: string | null;
  brand_name: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  line_url: string | null;
  logo_file_id: string | null;
  price_mode: SharedCatalogPriceMode;
  scope_type: SharedCatalogScope;
  source_product_id: string | null;
  source_project_id: string | null;
  status: SharedCatalogStatus;
  share_token: string;
  expires_at: string | null;
  current_version_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SharedCatalogItemRow = {
  id: string;
  catalog_id: string;
  product_id: string;
  customer_price: number | null;
  sort_order: number;
};
