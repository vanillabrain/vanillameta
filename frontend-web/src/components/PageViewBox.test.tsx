import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PageViewBox from './PageViewBox';
const viewport = vi.hoisted(() => ({ desktop: true }));
vi.mock('@mui/material', () => {
  const Container = ({ children }: any) => <div>{children}</div>;
  return {
    Avatar: Container,
    Box: Container,
    Divider: Container,
    Stack: Container,
    Typography: Container,
    useTheme: () => ({ breakpoints: { up: () => 'sm' } }),
    useMediaQuery: () => viewport.desktop,
  };
});
function StatefulChild() {
  const [value, setValue] = React.useState('');
  return <input aria-label="filter" value={value} onChange={e => setValue(e.target.value)} />;
}
afterEach(() => {
  cleanup();
  viewport.desktop = true;
});
it('preserves child state when crossing mobile and desktop breakpoints', () => {
  const view = render(
    <PageViewBox preserveChildren>
      <StatefulChild />
    </PageViewBox>,
  );
  fireEvent.change(screen.getByLabelText('filter'), { target: { value: 'Mobile,Tablet' } });
  viewport.desktop = false;
  view.rerender(
    <PageViewBox preserveChildren>
      <StatefulChild />
    </PageViewBox>,
  );
  expect((screen.getByLabelText('filter') as HTMLInputElement).value).toBe('Mobile,Tablet');
  viewport.desktop = true;
  view.rerender(
    <PageViewBox preserveChildren>
      <StatefulChild />
    </PageViewBox>,
  );
  expect((screen.getByLabelText('filter') as HTMLInputElement).value).toBe('Mobile,Tablet');
});
