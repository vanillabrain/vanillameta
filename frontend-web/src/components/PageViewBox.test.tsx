import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import PageViewBox from './PageViewBox';

const media = (() => {
  const listeners = new Set<(event: { matches: boolean }) => void>();
  let matches = true;
  return {
    set(value: boolean) {
      matches = value;
      listeners.forEach(listener => listener({ matches }));
    },
    install() {
      window.matchMedia = ((query: string) => ({
        get matches() {
          return matches;
        },
        media: query,
        addEventListener: (_type: string, listener: any) => listeners.add(listener),
        removeEventListener: (_type: string, listener: any) => listeners.delete(listener),
        addListener: (listener: any) => listeners.add(listener),
        removeListener: (listener: any) => listeners.delete(listener),
        dispatchEvent: () => false,
      })) as any;
    },
    reset() {
      listeners.clear();
      matches = true;
    },
  };
})();

function StatefulChild() {
  const [value, setValue] = React.useState('');
  return <input aria-label="filter" value={value} onChange={e => setValue(e.target.value)} />;
}

beforeEach(() => media.install());
afterEach(() => {
  cleanup();
  media.reset();
});

describe('responsive page shell', () => {
  it('preserves child state when crossing mobile and desktop breakpoints', () => {
    render(
      <PageViewBox preserveChildren>
        <StatefulChild />
      </PageViewBox>,
    );
    fireEvent.change(screen.getByLabelText('filter'), { target: { value: 'Mobile,Tablet' } });
    act(() => media.set(false));
    expect((screen.getByLabelText('filter') as HTMLInputElement).value).toBe('Mobile,Tablet');
    act(() => media.set(true));
    expect((screen.getByLabelText('filter') as HTMLInputElement).value).toBe('Mobile,Tablet');
    expect(document.querySelector('[data-slot="page-view-desktop"]')).toBeTruthy();
  });

  it('renders the mobile shell below the breakpoint', () => {
    media.set(false);
    render(<PageViewBox title="Saved">content</PageViewBox>);
    expect(document.querySelector('[data-slot="page-view-mobile"]')).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
  });
});
