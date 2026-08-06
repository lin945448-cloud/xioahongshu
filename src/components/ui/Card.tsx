import clsx from 'clsx';
import type { ReactNode } from 'react';

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Card({ title, subtitle, right, children, className, bodyClassName }: CardProps) {
  return (
    <section className={clsx('card animate-fade-up', className)}>
      {(title || right) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200/70 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 flex-wrap items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={clsx('card-pad', bodyClassName)}>{children}</div>
    </section>
  );
}

export function SectionTitle({
  icon,
  title,
  desc,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      {icon && (
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
          {icon}
        </span>
      )}
      <div>
        <h2 className="text-lg font-bold tracking-tight text-ink-900">{title}</h2>
        {desc && <p className="text-xs text-ink-500">{desc}</p>}
      </div>
    </div>
  );
}
