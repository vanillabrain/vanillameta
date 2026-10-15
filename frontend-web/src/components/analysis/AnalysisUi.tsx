import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Shared analysis/chart geometry. UI presentation uses Tailwind semantic tokens. */
export const ANALYSIS_UI = {
  controlHeight: 28,
  inputHeight: 32,
  fontSize: 12,
  bodySize: 13,
  radius: 4,
  gap: 8,
  accent: '#4f46e5',
  selected: '#eef2ff',
  border: '#e2e8f0',
  muted: '#64748b',
  surface: '#f8fafc',
} as const;

export const analysisToggleClassName =
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:border-primary';
export const analysisFieldClassName = 'min-w-0 text-xs';
export const analysisPanelClassName = 'min-w-0 rounded-md border bg-muted/40 p-3';
export const analysisModeGroupClassName =
  'inline-flex self-start items-center gap-0.5 rounded-md border bg-background p-0.5';
export const analysisTableCellClassName = 'border-b border-r px-2 py-1.5 text-xs leading-normal tabular-nums';

export function AnalysisUiProvider({ children }: React.PropsWithChildren) {
  return (
    <div data-analysis-ui className="flex min-w-0 flex-col gap-3 text-[13px]">
      {children}
    </div>
  );
}

export function AnalysisChoice({
  label,
  selected,
  ariaLabel,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, 'children'> & {
  label: React.ReactNode;
  selected?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={selected}
      aria-label={ariaLabel}
      className={cn(analysisToggleClassName, className)}
      {...props}
    >
      {label}
    </Button>
  );
}
