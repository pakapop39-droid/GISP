import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CatalogImportHistoryButton, revealCatalogImportDetail } from "./catalog-import-history";

const workspace = readFileSync(join(process.cwd(), "src/components/catalog-import-workspace.tsx"), "utf8");
const job = {
  id: "30000000-0000-4000-8000-000000000001",
  file_name: "synthetic.pdf",
  source_type: "PDF",
  status: "READY_FOR_REVIEW",
  total_rows: 100,
  valid_rows: 96,
  invalid_rows: 4,
  created_at: "2026-09-13T05:00:00.000Z",
};

describe("Catalog Import history navigation", () => {
  it("renders a clear accessible selected state for the active history job", () => {
    const selected = renderToStaticMarkup(createElement(CatalogImportHistoryButton, { job, selected: true, onSelect: () => undefined }));
    const unselected = renderToStaticMarkup(createElement(CatalogImportHistoryButton, { job, selected: false, onSelect: () => undefined }));

    expect(selected).toContain('aria-pressed="true"');
    expect(selected).toContain('aria-current="true"');
    expect(selected).toContain("กำลังดู");
    expect(selected).toContain("border-[#356b52]");
    expect(unselected).toContain('aria-pressed="false"');
    expect(unselected).not.toContain('aria-current="true"');
    expect(unselected).not.toContain("กำลังดู");
  });

  it("focuses and scrolls the loaded detail section accessibly", () => {
    const focus = vi.fn();
    const scrollIntoView = vi.fn();

    revealCatalogImportDetail({ focus, scrollIntoView });

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(focus.mock.invocationCallOrder[0]).toBeLessThan(scrollIntoView.mock.invocationCallOrder[0]);
  });

  it("requests reveal only for an intentional history selection after load succeeds", () => {
    expect(workspace).toContain("if(revealAfterLoad)setDetailRevealRequest");
    expect(workspace).toContain("void loadDetail(job.id,1,true)");
    expect(workspace).toContain("onReload={()=>loadDetail(detail.job.id,detail.pagination?.page??1)}");
    expect(workspace).toContain("onPage={(page)=>loadDetail(detail.job.id,page)}");
    expect(workspace).toContain('กำลังดูงาน: {detail.job.file_name}');
    expect(workspace).toContain('aria-labelledby="catalog-import-current-job"');
  });
});
