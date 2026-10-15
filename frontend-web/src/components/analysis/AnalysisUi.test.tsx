import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { AnalysisChoice, AnalysisUiProvider } from './AnalysisUi';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('exposes the selected state as a native pressed toggle that stays controlled by its owner', () => {
  const onClick = vi.fn();
  render(<AnalysisChoice label="Explore" selected onClick={onClick} />);

  const choice = screen.getByRole('button', { name: 'Explore' });
  expect(choice.getAttribute('aria-pressed')).toBe('true');
  expect(choice.getAttribute('data-state')).toBe('on');

  fireEvent.click(choice);
  expect(onClick).toHaveBeenCalledTimes(1);
  expect(choice.getAttribute('aria-pressed')).toBe('true');
  expect(choice.getAttribute('data-state')).toBe('on');
});

it('keeps unselected, explicit labels and disabled state as native button contracts', () => {
  render(
    <>
      <AnalysisChoice label="Pivot" ariaLabel="Pivot 전환" onClick={() => undefined} />
      <AnalysisChoice label="숫자 범위" disabled onClick={() => undefined} />
    </>,
  );

  const pivot = screen.getByRole('button', { name: 'Pivot 전환' });
  expect(pivot.getAttribute('aria-pressed')).toBe('false');
  expect(pivot.getAttribute('data-state')).toBe('off');
  expect((screen.getByRole('button', { name: '숫자 범위' }) as HTMLButtonElement).disabled).toBe(true);
});

it('styles the selected state with semantic tokens instead of raw colors or muted defaults', () => {
  const { container } = render(<AnalysisChoice label="Explore" selected />);
  const className = container.querySelector('button')?.getAttribute('class') ?? '';

  expect(className).toContain('data-[state=on]:bg-accent');
  expect(className).toContain('data-[state=on]:text-accent-foreground');
  expect(className).not.toContain('data-[state=on]:bg-muted');
  expect(className).not.toContain('aria-pressed:bg-muted');
  expect(className).not.toMatch(/#[0-9a-fA-F]{3,8}/);
});

it('keeps the analysis container contract', () => {
  render(
    <AnalysisUiProvider>
      <span>본문</span>
    </AnalysisUiProvider>,
  );

  const provider = document.querySelector('[data-analysis-ui]');
  expect(provider?.className).toContain('text-sm');
  expect(screen.getByText('본문')).not.toBeNull();
});
