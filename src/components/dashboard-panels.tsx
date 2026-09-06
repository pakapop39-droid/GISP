import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Boxes,
  CircleCheckBig,
  Clock3,
  PackageCheck,
  Ship,
  Truck,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type {
  CurrencyAmount,
  DashboardAction,
} from "@/modules/reports/types";

const metricIcons: Record<string, LucideIcon> = {
  action: AlertTriangle,
  order: PackageCheck,
  payment: Banknote,
  production: Boxes,
  shipment: Ship,
  delivery: Truck,
  claim: CircleCheckBig,
  time: Clock3,
};

export type DashboardMetric = {
  key: string;
  label: string;
  value: string | number;
  note: string;
  icon: keyof typeof metricIcons;
  tone?: "good" | "warning" | "bad" | "neutral";
};

export function DashboardMetricGrid({
  metrics,
}: {
  metrics: DashboardMetric[];
}) {
  return (
    <div className="slice10-metrics">
      {metrics.map((metric) => {
        const Icon = metricIcons[metric.icon];
        return (
          <article
            key={metric.key}
            className={`slice10-metric slice10-metric--${metric.tone ?? "neutral"}`}
          >
            <div>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.note}</small>
            </div>
            <i>
              <Icon size={19} />
            </i>
          </article>
        );
      })}
    </div>
  );
}

export function CurrencyAmounts({
  items,
  emptyLabel = "ไม่มียอดคงค้าง",
}: {
  items: CurrencyAmount[];
  emptyLabel?: string;
}) {
  if (!items.length) return <span className="slice10-empty-inline">{emptyLabel}</span>;
  return (
    <span className="slice10-currencies">
      {items.map((item) => (
        <b key={item.currency}>
          {new Intl.NumberFormat("th-TH", {
            style: "currency",
            currency: item.currency,
            maximumFractionDigits: 2,
          }).format(Number(item.amount))}
        </b>
      ))}
    </span>
  );
}

function actionHref(action: DashboardAction, portal: "member" | "admin") {
  if (action.action_type === "CLAIM_ACTION" || action.action_type === "CLAIM_INFORMATION") {
    return `/${portal}/claims/${action.entity_id}`;
  }
  if (action.order_id) return `/${portal}/orders/${action.order_id}`;
  return `/${portal}/dashboard`;
}

export function ActionRequiredList({
  actions,
  portal,
}: {
  actions: DashboardAction[];
  portal: "member" | "admin";
}) {
  return (
    <section className="v14-panel slice10-action-panel" aria-labelledby="action-required">
      <div className="v14-panel__head">
        <div>
          <p className="v14-eyebrow">Action required</p>
          <h2 id="action-required">สิ่งที่ต้องดำเนินการ</h2>
        </div>
        <span>{actions.length} รายการ</span>
      </div>
      {actions.length ? (
        <div className="slice10-action-list">
          {actions.map((action) => (
            <Link
              key={`${action.action_type}-${action.entity_id}`}
              href={actionHref(action, portal)}
            >
              <span className={`slice10-priority slice10-priority--${Math.min(action.priority, 5)}`}>
                {action.priority}
              </span>
              <span>
                <strong>{action.title}</strong>
                <small>
                  {action.reference}
                  {action.due_at
                    ? ` · กำหนด ${new Intl.DateTimeFormat("th-TH", {
                        timeZone: "Asia/Bangkok",
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(action.due_at))}`
                    : ""}
                </small>
              </span>
              {action.amount && action.currency ? (
                <b>
                  {new Intl.NumberFormat("th-TH", {
                    style: "currency",
                    currency: action.currency,
                  }).format(Number(action.amount))}
                </b>
              ) : null}
              <ArrowUpRight size={17} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="slice10-empty">
          <CircleCheckBig size={22} />
          <strong>ไม่มีงานเร่งด่วนในสิทธิ์ของคุณ</strong>
          <span>ระบบตรวจจากสถานะธุรกรรมล่าสุดแล้ว</span>
        </div>
      )}
    </section>
  );
}

export function DashboardErrorState() {
  return (
    <section className="v14-panel slice10-error" role="alert">
      <AlertTriangle size={22} />
      <div>
        <strong>โหลดข้อมูล Dashboard ไม่สำเร็จ</strong>
        <p>กรุณากดโหลดหน้าใหม่ หากยังพบปัญหาให้แจ้งทีมดูแลระบบ</p>
      </div>
    </section>
  );
}
