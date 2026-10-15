import React, { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StudioPanelSurface from './StudioPanelSurface';
vi.mock('@mui/material', () => ({ Drawer: ({ children }: any) => <div role="dialog">{children}</div> }));
afterEach(cleanup);
it('keeps mapping input state and the same mounted subtree while switching rail and mobile modal', () => {
  const mount = vi.fn(),
    unmount = vi.fn();
  function Mapping() {
    const [value, setValue] = useState('original');
    useEffect(() => {
      mount();
      return () => unmount();
    }, []);
    return <input aria-label="mapping" value={value} onChange={e => setValue(e.target.value)} />;
  }
  const view = render(
    <StudioPanelSurface compact={false} onClose={vi.fn()}>
      <Mapping />
    </StudioPanelSurface>,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'mapping' }), { target: { value: 'confirmed-column' } });
  view.rerender(
    <StudioPanelSurface compact onClose={vi.fn()}>
      <Mapping />
    </StudioPanelSurface>,
  );
  expect((screen.getByRole('textbox', { name: 'mapping' }) as HTMLInputElement).value).toBe('confirmed-column');
  view.rerender(
    <StudioPanelSurface compact={false} onClose={vi.fn()}>
      <Mapping />
    </StudioPanelSurface>,
  );
  expect((screen.getByRole('textbox', { name: 'mapping' }) as HTMLInputElement).value).toBe('confirmed-column');
  expect(mount).toHaveBeenCalledOnce();
  expect(unmount).not.toHaveBeenCalled();
});
