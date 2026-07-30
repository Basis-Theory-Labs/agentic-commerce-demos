// Successor to the old "how" box: deeper context that doesn't belong in a
// step lead. Tone defaults to neutral; "warning" for production banners etc.
export function Callout({
  title,
  tone = "neutral",
  children,
}: {
  title?: string;
  tone?: "neutral" | "warning" | "error" | "success";
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-ink-200 bg-ink-50",
    warning: "border-warning-border bg-warning-soft",
    error: "border-error-border bg-error-soft",
    success: "border-success-border bg-success-soft",
  };
  return (
    <div
      className={`rounded-lg border ${tones[tone]} px-3 py-2 text-xs leading-relaxed text-ink-700`}
    >
      {title && <div className="mb-0.5 font-semibold text-ink-950">{title}</div>}
      {children}
    </div>
  );
}
