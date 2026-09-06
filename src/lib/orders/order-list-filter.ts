import type { OrderListRow } from "./types";

function normalizeSearchValue(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("th");
}

export function filterOrderRows(
  rows: OrderListRow[],
  query: string,
  status: string,
) {
  const normalizedQuery = normalizeSearchValue(query);

  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!normalizedQuery) return true;

    const searchableText = [
      row.order_number,
      row.project?.project_number,
      row.project?.name,
      row.member?.company_name,
      row.member?.contact_name,
    ]
      .filter(Boolean)
      .join(" ");

    return normalizeSearchValue(searchableText).includes(normalizedQuery);
  });
}
