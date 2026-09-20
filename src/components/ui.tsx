import type { ReactNode } from "react";

// Primitives for "Forest Slate & Pale Linen" Design System
// Radius rules: Inputs, buttons, badges -> 4px (rounded-[4px])
// Cards, containers -> 8px (rounded-[8px])
// Modals, large panels -> 12px (rounded-[12px])
// Status pills / dot indicators -> fully rounded (rounded-full)

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[8px] border border-border-hairline bg-surface-2 p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  loading = false,
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 rounded-[4px] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider font-body transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    // Buttons primary: bg --accent, text #002116, hover --accent-hover, active --accent-pressed
    primary: "bg-accent text-[#002116] hover:bg-accent-hover active:bg-accent-pressed shadow-none",
    // Buttons secondary/outline: transparent bg, --border-hairline border, --text-secondary text; hover -> --surface-3 bg + --accent-pressed border + --text-primary text
    secondary: "bg-transparent text-ink-secondary border border-border-hairline hover:bg-surface-3 hover:border-accent-pressed hover:text-ink-primary",
    // Ghost buttons: transparent, --text-muted, hover bg --surface-1
    ghost: "bg-transparent text-ink-muted hover:text-ink-primary hover:bg-surface-1",
    // Danger: subtle semantic
    danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props} disabled={props.disabled || loading} aria-busy={loading || undefined}>
      {loading && <span aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-transparent border-t-current" />}
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[4px] border border-border-hairline bg-surface-1 px-3 py-1.5 text-sm text-ink-primary placeholder:text-ink-disabled outline-none transition-colors focus:border-border-focus font-body ${props.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-[4px] border border-border-hairline bg-surface-1 px-3 py-2 text-sm text-ink-primary placeholder:text-ink-disabled outline-none transition-colors focus:border-border-focus font-body ${props.className || ""}`}
    />
  );
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-[4px] border border-border-hairline bg-surface-1 px-3 py-1.5 text-sm text-ink-primary outline-none transition-colors focus:border-border-focus font-body ${props.className || ""}`}
    >
      {children}
    </select>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-ink-muted font-body">
      {children}
    </label>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "verified";
}) {
  // Badges/pills/status chips: JetBrains Mono 11-12px, bg --surface-2, border --border-hairline, text --text-muted
  // "verified/active" variant uses rgba(var(--accent-rgb), 0.12) bg, rgba(var(--accent-rgb), 0.35) border, --accent-hover text
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-ink-muted border-border-hairline",
    success: "bg-[rgba(78,135,112,0.14)] text-accent-hover border-[rgba(78,135,112,0.35)]",
    verified: "bg-[rgba(78,135,112,0.14)] text-accent-hover border-[rgba(78,135,112,0.35)]",
    warning: "bg-warning/15 text-warning border-warning/30",
    danger: "bg-danger/15 text-danger border-danger/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-border-hairline py-12 text-center bg-surface-1">
      <p className="font-display text-lg font-medium text-ink-primary">{title}</p>
      {description && <p className="mt-1 text-sm text-ink-muted font-body">{description}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-normal text-ink-primary tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-xs uppercase tracking-wider text-ink-muted font-mono">{description}</p>}
      </div>
      {actions}
    </div>
  );
}


export function IconButton({
  icon,
  label,
  onClick,
  variant = "ghost",
  className = "",
  disabled = false,
}: {
  icon: string;
  label: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "ghost" | "danger";
  className?: string;
  disabled?: boolean;
}) {
  const variants = {
    ghost: "text-ink-muted hover:bg-surface-3 hover:text-ink-primary",
    danger: "text-danger hover:bg-danger/15",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`rounded-[4px] p-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">
        {icon}
      </span>
    </button>
  );
}

export function RadioCard({
  selected,
  onSelect,
  title,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer rounded-[8px] border p-4 outline-none transition-colors focus-visible:border-border-focus ${
        selected ? "border-accent bg-accent/10" : "border-border-hairline bg-surface-2 hover:bg-surface-3"
      }`}
    >
      <p className="text-sm font-medium text-ink-primary font-body">{title}</p>
      {description && <p className="mt-1 text-xs text-ink-muted font-body">{description}</p>}
      {children}
    </div>
  );
}

export function StatusBanner({
  tone,
  children,
  className = "",
}: {
  tone: "danger" | "warning" | "success";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    danger: "border-danger/30 bg-danger/10 text-danger",
    warning: "border-warning/30 bg-warning/10 text-warning",
    success: "border-success/30 bg-success/10 text-success",
  };
  return (
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-[4px] border px-3 py-2 text-xs font-mono ${tones[tone]} ${className}`}
    >
      {children}
    </p>
  );
}
