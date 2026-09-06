export const fixedReportTypes = [
  "order",
  "payment",
  "delay",
  "delivery",
  "claim",
] as const;

export type FixedReportType = (typeof fixedReportTypes)[number];

export type CurrencyAmount = {
  currency: string;
  amount: number;
};

export type DashboardAction = {
  priority: number;
  action_type: string;
  entity_id: string;
  order_id: string | null;
  reference: string;
  title: string;
  amount?: number | null;
  currency?: string | null;
  due_at: string | null;
  created_at: string;
};

export type MemberDashboard = {
  generated_at: string;
  metrics: {
    action_required: number;
    active_orders: number;
    orders_in_production: number;
    shipments_in_transit: number;
    upcoming_deliveries: number;
    open_claims: number;
    outstanding_by_currency: CurrencyAmount[];
  };
  actions: DashboardAction[];
};

export type AdminOperationsDashboard = {
  generated_at: string;
  permissions: Record<string, boolean>;
  metrics: {
    action_required: number;
    active_orders: number | null;
    payment_reviews: number | null;
    production_delays: number | null;
    qc_actions: number | null;
    shipments_in_transit: number | null;
    deliveries_due: number | null;
    open_claims: number | null;
  };
  actions: DashboardAction[];
};

export type ExecutiveDashboard = {
  generated_at: string;
  filters: { date_from: string; date_to: string };
  financial: {
    order_value: CurrencyAmount[];
    collected: CurrencyAmount[];
    customer_outstanding: CurrencyAmount[];
    supplier_payable: CurrencyAmount[];
    freight_outstanding: CurrencyAmount[];
  };
  operational: {
    active_orders: number;
    orders_in_production: number;
    production_delayed: number;
    qc_issues: number;
    goods_in_transit: number;
    deliveries_due: number;
    open_claims: number;
  };
  business: {
    active_members: number;
    members_with_orders: number;
    active_suppliers: number;
    active_products: number;
  };
};

export type FixedReportFilters = {
  type: FixedReportType;
  dateFrom: string;
  dateTo: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export type FixedReportRow = Record<
  string,
  string | number | boolean | null
>;

export type FixedReport = {
  report_type: FixedReportType;
  generated_at: string;
  filters: {
    date_from: string;
    date_to: string;
    status: string | null;
    limit: number;
    offset: number;
  };
  row_count: number;
  rows: FixedReportRow[];
};
