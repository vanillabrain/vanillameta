import React from 'react';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

/**
 * Shared analysis/chart geometry. Chart rendering and the placement canvas may consume these raw
 * values; static UI presentation uses Tailwind semantic tokens instead.
 */
export const ANALYSIS_UI = {
  controlHeight: 32,
  inputHeight: 36,
  fontSize: 14,
  bodySize: 14,
  radius: 4,
  gap: 8,
  accent: '#4f46e5',
  selected: '#eef2ff',
  border: '#e2e8f0',
  muted: '#64748b',
  surface: '#f8fafc',
} as const;

/**
 * Selected state of AnalysisChoice, keyed off the native toggle state with semantic tokens only.
 * rounded-md/px-3 keep the 32px analysis control metrics this control had as a Button sm.
 */
export const analysisToggleClassName =
  'rounded-md px-3 aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground data-[state=on]:border-primary data-[state=on]:bg-accent data-[state=on]:text-accent-foreground';
export const analysisFieldClassName = 'min-w-0 text-sm';
export const analysisPanelClassName = 'min-w-0 rounded-xl border bg-card p-4 sm:p-5';
export const analysisModeGroupClassName = 'inline-flex self-start items-center gap-1 rounded-lg border bg-muted/50 p-1';
export const analysisTableCellClassName = 'border-b border-r px-3 py-2.5 text-sm leading-normal tabular-nums';

export function AnalysisUiProvider({ children }: React.PropsWithChildren) {
  return (
    <div data-analysis-ui className="flex min-w-0 flex-col gap-5 text-sm">
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
}: Omit<React.ComponentProps<typeof Toggle>, 'children' | 'pressed' | 'defaultPressed'> & {
  label: React.ReactNode;
  selected?: boolean;
  ariaLabel?: string;
}) {
  return (
    <Toggle
      variant="outline"
      size="default"
      pressed={selected ?? false}
      aria-label={ariaLabel}
      className={cn(analysisToggleClassName, className)}
      {...props}
    >
      {label}
    </Toggle>
  );
}
