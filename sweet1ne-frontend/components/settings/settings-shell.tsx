"use client";

export function SettingsSection({
  title,
  description,
  children,
  tone,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  tone: "admin" | "branch";
}) {
  const isBranch = tone === "branch";
  const card = isBranch
    ? "border-slate-bg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "border-[var(--gold-line)] bg-[var(--panel-2)]";
  const text = isBranch ? "text-navy" : "text-[var(--ivory)]";
  const muted = isBranch ? "text-slate-muted" : "text-[var(--ivory-dim)]";
  const border = isBranch ? "border-slate-border" : "border-[var(--gold-line)]";

  return (
    <section className={`overflow-hidden rounded-xl border ${card}`}>
      <div className={`border-b px-5 py-4 ${border}`}>
        <h2 className={`font-semibold ${text}`}>{title}</h2>
        {description && <p className={`mt-0.5 text-sm ${muted}`}>{description}</p>}
      </div>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  tone,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  tone: "admin" | "branch";
}) {
  const isBranch = tone === "branch";
  const on = isBranch ? "bg-emerald" : "bg-[var(--gold)]";
  const off = isBranch ? "bg-slate-border" : "bg-[rgba(201,162,74,0.18)]";
  const text = isBranch ? "text-navy" : "text-[var(--ivory)]";
  const muted = isBranch ? "text-slate-muted" : "text-[var(--ivory-dim)]";

  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="min-w-0">
        <span className={`block text-sm ${text}`}>{label}</span>
        {hint && <span className={`mt-0.5 block text-xs ${muted}`}>{hint}</span>}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? on : off
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}