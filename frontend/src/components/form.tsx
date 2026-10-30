import { AlertCircle, LoaderCircle } from "lucide-react";

export const inputBase =
  "rounded-lg border border-zinc-200 bg-white px-3 py-[7px] text-base text-ink sm:text-sm shadow-xs outline-none transition placeholder:text-zinc-400 hover:border-zinc-300 focus:border-brand-600 focus:ring-3 focus:ring-brand-600/15 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";
export const inputClass = `w-full ${inputBase}`;

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-zinc-800">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white shadow-xs hover:bg-brand-800",
  secondary: "border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50 hover:border-zinc-300",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "bg-red-600 text-white shadow-xs hover:bg-red-700",
};
const sizes: Record<Size, string> = {
  sm: "h-9 gap-1.5 px-3 text-[13px] sm:h-8 sm:px-2.5",
  md: "h-10 gap-2 px-4 text-sm sm:h-9 sm:px-3.5",
  lg: "h-11 gap-2 px-4 text-sm sm:h-10",
};

export const buttonClass = (variant: Variant = "primary", size: Size = "md") =>
  `inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]}`;

export function Button({
  loading,
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; variant?: Variant; size?: Size }) {
  return (
    <button {...props} disabled={loading || props.disabled} className={`${buttonClass(variant, size)} ${className}`}>
      {loading && <LoaderCircle size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  children,
  tone = "default",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "default" | "danger" }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={label}
      className={`grid size-9 shrink-0 place-items-center rounded-lg sm:size-8 text-zinc-500 transition hover:bg-zinc-100 ${
        tone === "danger" ? "hover:text-red-600" : "hover:text-zinc-900"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-lg bg-zinc-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 sm:h-7 sm:px-2.5 text-[13px] font-medium transition disabled:cursor-not-allowed ${
            value === o.value ? "bg-white text-zinc-900 shadow-xs" : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
