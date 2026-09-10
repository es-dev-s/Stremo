import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function PageCanvas({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full w-full min-w-0 flex-col px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
      <header className="mb-3 w-full sm:mb-4">
        <h1 className="text-[17px] font-semibold tracking-[-0.03em] text-ink-strong">
          {title}
        </h1>
        <p className="mt-0.5 max-w-2xl text-[12px] leading-5 text-muted">
          {subtitle}
        </p>
      </header>
      <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

export function GlassBoard({ children }: { children: ReactNode }) {
  return (
    <section className="glass-panel flex min-h-0 w-full min-w-0 flex-1 flex-col rounded-2xl p-3.5 sm:p-5">
      {children}
    </section>
  );
}

export function EmptyHint({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <GlassBoard>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-faint">
        <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
        <p className="text-[13px]">{label}</p>
      </div>
    </GlassBoard>
  );
}
