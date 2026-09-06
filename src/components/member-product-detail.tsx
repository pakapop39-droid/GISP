"use client";

import {
  ArrowLeft,
  Box,
  Check,
  Clock3,
  Download,
  LoaderCircle,
  PackageCheck,
  PackageSearch,
  Ruler,
  Share2,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { buildProjectItemSelection } from "@/lib/projects/catalog-selection";

type Detail = {
  id: string;
  sku: string;
  productType: string;
  nameTh: string;
  nameEn: string | null;
  descriptionTh: string | null;
  specificationSummary: string | null;
  leadTimeDays: number | null;
  countryCode: string;
  dimensions: {
    widthMm: number | null;
    depthMm: number | null;
    heightMm: number | null;
  };
  weightKg: number | null;
  cbm: number | null;
  materialSummary: string | null;
  finishSummary: string | null;
  moq: number | null;
  category: { id: string; name: string | null } | null;
  partnerSourceLabel: string;
  warrantySummary: string;
  samples: Array<{
    id: string;
    code: string;
    type: "MATERIAL_SWATCH" | "BUILT_IN_DISPLAY";
    displayName: string;
    memberNote: string | null;
    availabilityStatus: "AVAILABLE" | "BORROWED" | "UNAVAILABLE";
    countryCode: string;
    city: string;
    publicLocationLabel: string;
  }>;
  warranty: {
    versionNumber: number;
    title: string;
    memberSummary: string;
    termsText: string;
    durationMonths: number | null;
    effectiveFrom: string;
  } | null;
  price: {
    memberPrice: number;
    suggestedResalePrice: number | null;
    freightEstimateLow: number | null;
    freightEstimateHigh: number | null;
    currency: string;
  };
  images: Array<{ id: string; url: string }>;
  variants: Array<{
    id: string;
    sku: string;
    name: string;
    specification_summary: string | null;
    width_mm: number | null;
    depth_mm: number | null;
    height_mm: number | null;
  }>;
  options: Array<{
    id: string;
    name: string;
    isRequired: boolean;
    values: Array<{ id: string; label: string; memberPriceDelta: number }>;
  }>;
  documents: Array<{
    id: string;
    type: string;
    name: string;
    downloadUrl: string;
    expiresInSeconds: number;
  }>;
};
type ProjectSummary = {
  id: string;
  project_number: string;
  name: string;
  status: string;
};
const money = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function MemberProductDetail({ productId }: { productId: string }) {
  const [data, setData] = useState<Detail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState("");
  const [options, setOptions] = useState<Record<string, string>>({});
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [addingToProject, setAddingToProject] = useState(false);
  const [projectError, setProjectError] = useState("");
  const [addedProjectId, setAddedProjectId] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/member/catalog/${productId}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          data?: Detail;
          message?: string;
        };
        if (!response.ok || !body.data)
          throw new Error(body.message ?? "โหลดสินค้าไม่สำเร็จ");
        setData(body.data);
        setVariantId(body.data.variants[0]?.id ?? "");
        setOptions(
          Object.fromEntries(
            body.data.options.map((option) => [
              option.id,
              option.values[0]?.id ?? "",
            ]),
          ),
        );
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;
        setError(
          caught instanceof Error ? caught.message : "โหลดสินค้าไม่สำเร็จ",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [productId]);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/member/projects", {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          data?: ProjectSummary[];
          message?: string;
        };
        if (!response.ok)
          throw new Error(body.message ?? "โหลดรายการโครงการไม่สำเร็จ");
        const availableProjects = (body.data ?? []).filter(
          (project) =>
            project.status !== "COMPLETED" && project.status !== "CANCELLED",
        );
        setProjects(availableProjects);
        setTargetProjectId(availableProjects[0]?.id ?? "");
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError")
          return;
        setProjectError(
          caught instanceof Error
            ? caught.message
            : "โหลดรายการโครงการไม่สำเร็จ",
        );
      } finally {
        if (!controller.signal.aborted) setProjectsLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);
  const optionDelta = useMemo(
    () =>
      data?.options.reduce((total, option) => {
        const value = option.values.find(
          (item) => item.id === options[option.id],
        );
        return total + (value?.memberPriceDelta ?? 0);
      }, 0) ?? 0,
    [data?.options, options],
  );
  async function addToProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !targetProjectId) return;

    const selection = buildProjectItemSelection(data.options, options);
    if (selection.missingRequiredOptions.length) {
      setProjectError(
        `กรุณาเลือก ${selection.missingRequiredOptions.join(", ")} ให้ครบ`,
      );
      return;
    }

    setAddingToProject(true);
    setProjectError("");
    setAddedProjectId("");
    try {
      const response = await fetch(
        `/api/member/projects/${targetProjectId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(20_000),
          body: JSON.stringify({
            areaId: null,
            productId: data.id,
            variantId: variantId || null,
            selectedOptions: selection.selectedOptions,
            quantity,
          }),
        },
      );
      const body = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(body.message ?? "เพิ่มสินค้าเข้าโครงการไม่สำเร็จ");
      setAddedProjectId(targetProjectId);
    } catch (caught) {
      setProjectError(
        caught instanceof Error
          ? caught.message
          : "เพิ่มสินค้าเข้าโครงการไม่สำเร็จ",
      );
    } finally {
      setAddingToProject(false);
    }
  }
  if (loading)
    return (
      <section className="v14-panel v14-empty">
        <LoaderCircle className="animate-spin" />
        กำลังโหลดรายละเอียดสินค้า…
      </section>
    );
  if (error || !data)
    return (
      <section className="v14-panel member-catalog__empty">
        <Box size={32} />
        <h2>เปิดสินค้านี้ไม่ได้</h2>
        <p>{error || "ไม่พบสินค้า"}</p>
        <Link href="/member/catalog" className="v14-button v14-button--outline">
          กลับ Catalog
        </Link>
      </section>
    );
  const currentImage = data.images[activeImage]?.url;
  return (
    <div className="member-detail">
      <Link href="/member/catalog" className="member-detail__back">
        <ArrowLeft size={14} />
        กลับ Catalog
      </Link>
      <section className="member-detail__hero">
        <div className="member-gallery">
          <div className="member-gallery__main">
            {currentImage ? (
              <Image
                src={currentImage}
                alt={data.nameTh}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                unoptimized
              />
            ) : (
              <Box size={44} />
            )}
          </div>
          {data.images.length > 1 ? (
            <div className="member-gallery__thumbs">
              {data.images.map((image, index) => (
                <button
                  className={index === activeImage ? "active" : ""}
                  key={image.id}
                  onClick={() => setActiveImage(index)}
                >
                  <Image
                    src={image.url}
                    alt={`${data.nameTh} รูป ${index + 1}`}
                    fill
                    sizes="80px"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="member-detail__summary">
          <p className="v14-eyebrow">
            {data.category?.name ?? data.productType}
          </p>
          <h1>{data.nameTh}</h1>
          {data.nameEn ? (
            <p className="member-detail__en">{data.nameEn}</p>
          ) : null}
          <div className="member-detail__codes">
            <span>{data.sku}</span>
            <span>{data.partnerSourceLabel}</span>
            <span>{data.countryCode}</span>
          </div>
          <div className="member-detail__price">
            <small>ราคาสมาชิกก่อน VAT</small>
            <strong>
              {money.format(data.price.memberPrice + optionDelta)}{" "}
              <em>{data.price.currency}</em>
            </strong>
            {optionDelta > 0 ? (
              <p>
                รวม Option เพิ่ม {money.format(optionDelta)}{" "}
                {data.price.currency}
              </p>
            ) : null}
            <dl>
              <div>
                <dt>ราคาแนะนำสำหรับขายต่อ</dt>
                <dd>
                  {data.price.suggestedResalePrice === null
                    ? "—"
                    : money.format(data.price.suggestedResalePrice)}{" "}
                  {data.price.currency}
                </dd>
              </div>
              <div>
                <dt>ค่าขนส่งประมาณการ</dt>
                <dd>
                  {data.price.freightEstimateLow === null
                    ? "—"
                    : money.format(data.price.freightEstimateLow)}
                  –
                  {data.price.freightEstimateHigh === null
                    ? "—"
                    : money.format(data.price.freightEstimateHigh)}{" "}
                  {data.price.currency}
                </dd>
              </div>
            </dl>
            <p className="member-detail__price-note">
              ราคาสมาชิกเป็นราคาสินค้า ไม่รวมค่าขนส่ง ค่านำเข้า VAT
              และค่าจัดส่งหน้างาน
            </p>
          </div>
          <div className="member-detail__lead">
            <Clock3 size={16} />
            <span>
              <small>Lead time โดยประมาณ</small>
              <strong>{data.leadTimeDays ?? "—"} วัน</strong>
            </span>
          </div>
          {data.variants.length ? (
            <label>
              Variant
              <select
                value={variantId}
                onChange={(event) => setVariantId(event.target.value)}
              >
                {data.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.sku} — {variant.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {data.options.map((option) => (
            <label key={option.id}>
              {option.name}
              {option.isRequired ? " *" : ""}
              <select
                value={options[option.id] ?? ""}
                onChange={(event) =>
                  setOptions((current) => ({
                    ...current,
                    [option.id]: event.target.value,
                  }))
                }
              >
                {option.values.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.label}
                    {value.memberPriceDelta
                      ? ` (+${money.format(value.memberPriceDelta)} THB)`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <form className="member-detail__project-form" onSubmit={addToProject}>
            <strong>เพิ่มสินค้านี้เข้า Project</strong>
            {projectsLoading ? (
              <p className="member-detail__project-note">
                <LoaderCircle className="animate-spin" size={14} />
                กำลังโหลดโครงการ…
              </p>
            ) : projects.length ? (
              <>
                <div className="member-detail__project-grid">
                  <label>
                    โครงการ
                    <select
                      value={targetProjectId}
                      onChange={(event) => {
                        setTargetProjectId(event.target.value);
                        setAddedProjectId("");
                      }}
                      required
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.project_number} — {project.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    จำนวน
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(Number(event.target.value))
                      }
                      required
                    />
                  </label>
                </div>
                <button
                  className="v14-button v14-button--dark"
                  disabled={addingToProject || quantity <= 0}
                >
                  {addingToProject ? (
                    <LoaderCircle className="animate-spin" size={15} />
                  ) : (
                    <PackageCheck size={15} />
                  )}
                  {addingToProject ? "กำลังเพิ่ม…" : "เพิ่มเข้า Project"}
                </button>
              </>
            ) : (
              <Link
                href="/member/projects"
                className="v14-button v14-button--dark"
              >
                <PackageCheck size={15} />
                สร้าง Project ก่อน
              </Link>
            )}
            {projectError ? (
              <p className="member-detail__project-error" role="alert">
                {projectError}
              </p>
            ) : null}
            {addedProjectId ? (
              <p className="member-detail__project-success" role="status">
                <Check size={14} /> เพิ่มสินค้าแล้ว ·{" "}
                <Link href={`/member/projects/${addedProjectId}`}>
                  เปิด Project
                </Link>
              </p>
            ) : null}
          </form>
          <Link href={`/member/shared-catalogs?scope=PRODUCT&productId=${data.id}`} className="v14-button v14-button--outline">
            <Share2 size={15}/>ส่งสินค้านี้ให้ลูกค้าดู
          </Link>
          <div className="member-detail__safe">
            <ShieldCheck size={15} />
            <span>หน้านี้แสดงเฉพาะข้อมูลและราคาที่ผ่านการ Publish</span>
          </div>
        </div>
      </section>
      <section className="member-detail__facts">
        <article>
          <Ruler size={18} />
          <span>
            <small>ขนาด ก × ล × ส</small>
            <strong>
              {data.dimensions.widthMm ?? "—"} ×{" "}
              {data.dimensions.depthMm ?? "—"} ×{" "}
              {data.dimensions.heightMm ?? "—"} มม.
            </strong>
          </span>
        </article>
        <article>
          <Box size={18} />
          <span>
            <small>วัสดุหลัก</small>
            <strong>{data.materialSummary ?? "—"}</strong>
          </span>
        </article>
        <article>
          <Check size={18} />
          <span>
            <small>การรับประกัน</small>
            <strong>{data.warrantySummary}</strong>
          </span>
        </article>
      </section>
      <section className="v14-panel member-detail__description">
        <div>
          <p className="v14-eyebrow">Product information</p>
          <h2>รายละเอียดและสเปก</h2>
        </div>
        <div>
          <article>
            <h3>รายละเอียด</h3>
            <p>{data.descriptionTh ?? "ยังไม่มีรายละเอียดเพิ่มเติม"}</p>
          </article>
          <article>
            <h3>Specification</h3>
            <p>{data.specificationSummary ?? "ยังไม่มีสเปกเพิ่มเติม"}</p>
          </article>
          <article>
            <h3>วัสดุและผิวสำเร็จ</h3>
            <p>
              {data.materialSummary ?? "—"}
              {data.finishSummary ? ` · ${data.finishSummary}` : ""}
            </p>
          </article>
        </div>
      </section>
      <section className="member-detail__service-grid">
        <article className="v14-panel member-detail__service-card">
          <div className="v14-panel__head"><div><p className="v14-eyebrow">Samples</p><h2>ตัวอย่างสินค้า</h2></div><PackageSearch size={22}/></div>
          {data.samples.length ? <div className="member-detail__sample-list">{data.samples.map(sample => <div key={sample.id}><span><strong>{sample.displayName}</strong><small>{sample.type === "BUILT_IN_DISPLAY" ? "ชุดตัวอย่าง Built-in" : "ตัวอย่างวัสดุ"} · {sample.code}</small></span><span><b>{sample.availabilityStatus === "AVAILABLE" ? "พร้อมให้บริการ" : sample.availabilityStatus === "BORROWED" ? "ถูกยืม" : "ไม่พร้อมให้บริการ"}</b><small>{sample.publicLocationLabel} · {sample.city}, {sample.countryCode}</small></span>{sample.memberNote ? <p>{sample.memberNote}</p> : null}</div>)}</div> : <p className="member-detail__service-empty">สินค้านี้ยังไม่มีตัวอย่างที่ลงทะเบียน</p>}
        </article>
        <article className="v14-panel member-detail__service-card">
          <div className="v14-panel__head"><div><p className="v14-eyebrow">Partner warranty</p><h2>เงื่อนไขรับประกัน</h2></div><ShieldCheck size={22}/></div>
          {data.warranty ? <div className="member-detail__warranty"><strong>{data.warranty.title}</strong><p>{data.warranty.memberSummary}</p><dl><div><dt>ระยะเวลา</dt><dd>{data.warranty.durationMonths ? `${data.warranty.durationMonths} เดือน` : "ตามเงื่อนไข"}</dd></div><div><dt>ฉบับ</dt><dd>Version {data.warranty.versionNumber}</dd></div></dl><details><summary>อ่านเงื่อนไขฉบับเต็ม</summary><p>{data.warranty.termsText}</p></details></div> : <p className="member-detail__service-empty">ใช้เงื่อนไขมาตรฐานตามใบเสนอราคา</p>}
        </article>
      </section>
      {data.documents.length ? (
        <section className="v14-panel member-detail__documents">
          <div className="v14-panel__head">
            <div>
              <p className="v14-eyebrow">Member documents</p>
              <h2>เอกสารสินค้า</h2>
            </div>
            <small>ลิงก์มีอายุ 5 นาที</small>
          </div>
          {data.documents.map((document) => (
            <a
              key={document.id}
              href={document.downloadUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <strong>{document.name}</strong>
                <small>{document.type}</small>
              </span>
              <Download size={16} />
            </a>
          ))}
        </section>
      ) : null}
    </div>
  );
}
