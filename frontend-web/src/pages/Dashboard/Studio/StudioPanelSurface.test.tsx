import React, { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StudioPanelSurface from './StudioPanelSurface';
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

it('contains keyboard focus in the mobile sheet and returns it to the opener on Escape', async () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open panel</button>
        {open && (
          <StudioPanelSurface compact onClose={() => setOpen(false)}>
            <input aria-label="draft question" />
            <button>Inside action</button>
          </StudioPanelSurface>
        )}
      </>
    );
  }
  render(<Host />);
  const opener = screen.getByRole('button', { name: 'Open panel' });
  opener.focus();
  fireEvent.click(opener);
  const dialog = await screen.findByRole('dialog', { name: 'Studio 보조 패널' });
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(opener);
});

it('restores the equivalent trigger when responsive layout replaces its DOM element', async () => {
  function Host({ version }: { version: number }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button key={version} aria-label="Block settings" onClick={() => setOpen(true)}>
          Settings
        </button>
        {open && (
          <StudioPanelSurface compact onClose={() => setOpen(false)}>
            <input aria-label="mapping draft" />
          </StudioPanelSurface>
        )}
      </>
    );
  }
  const view = render(<Host version={0} />);
  const original = screen.getByRole('button', { name: 'Block settings' });
  original.focus();
  fireEvent.click(original);
  await screen.findByRole('dialog');
  view.rerender(<Host version={1} />);
  expect(original.isConnected).toBe(false);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Block settings' }));
});
