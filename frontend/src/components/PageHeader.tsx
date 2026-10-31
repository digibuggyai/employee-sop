export default function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-zinc-900 md:text-2xl md:font-semibold">{title}</h1>
        {subtitle && (
          <p className={`mt-0.5 text-[13px] text-zinc-500 md:mt-1 md:text-sm ${typeof subtitle === "string" && subtitle.length > 45 ? "hidden md:block" : ""}`}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
