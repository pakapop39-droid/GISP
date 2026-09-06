"use client";

import { CheckCircle2, LoaderCircle, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";

export type ActionField = {
  name: string;
  label: string;
  placeholder: string;
  type?: "text" | "number" | "textarea";
  required?: boolean;
};

export type ActionDefinition = {
  title: string;
  description: string;
  endpoint: string;
  submitLabel: string;
  fields: ActionField[];
};

export function QuickActionForm({
  definition,
}: {
  definition: ActionDefinition;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    | { tone: "success" | "error"; message: string }
    | undefined
  >();

  async function submit(formData: FormData) {
    setPending(true);
    setResult(undefined);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(definition.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.message ?? body.error ?? "บันทึกไม่สำเร็จ");
      }
      setResult({
        tone: "success",
        message: body.message ?? "บันทึกเรียบร้อยแล้ว",
      });
    } catch (error) {
      setResult({
        tone: "error",
        message: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      action={submit}
      className="rounded-[28px] border border-ink/10 bg-ink p-6 text-porcelain shadow-[0_28px_70px_rgba(23,32,28,.2)]"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brass">
        Quick action
      </p>
      <h2 className="mt-2 font-display text-2xl font-semibold">
        {definition.title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-porcelain/55">
        {definition.description}
      </p>

      <div className="mt-6 space-y-4">
        {definition.fields.map((field) => (
          <label key={field.name} className="block">
            <span className="mb-1.5 block text-xs font-semibold text-porcelain/65">
              {field.label}
            </span>
            {field.type === "textarea" ? (
              <textarea
                name={field.name}
                required={field.required}
                placeholder={field.placeholder}
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.065] px-3.5 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-brass/55"
              />
            ) : (
              <input
                name={field.name}
                required={field.required}
                type={field.type ?? "text"}
                inputMode={field.type === "number" ? "decimal" : undefined}
                placeholder={field.placeholder}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.065] px-3.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-brass/55"
              />
            )}
          </label>
        ))}
      </div>

      {result && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
            result.tone === "success"
              ? "bg-jade/25 text-[#c9f4e5]"
              : "bg-lacquer/30 text-[#ffd7d2]"
          }`}
        >
          {result.tone === "success" ? (
            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          ) : (
            <TriangleAlert size={15} className="mt-0.5 shrink-0" />
          )}
          {result.message}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brass font-bold text-ink transition hover:bg-[#caa263] disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle size={17} className="animate-spin" />
        ) : (
          <Send size={16} />
        )}
        {pending ? "กำลังบันทึก" : definition.submitLabel}
      </button>
    </form>
  );
}
