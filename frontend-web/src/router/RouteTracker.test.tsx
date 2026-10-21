import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
const tracking = vi.hoisted(() => ({ pageView: vi.fn() }));
vi.mock('@/utils/analytics', () => ({ trackNavigation: tracking }));
import { RouteTracker } from './RouteTracker';
afterEach(() => {
  cleanup();
  tracking.pageView.mockReset();
});
describe('preserved main route analytics', () => {
  it('continues tracking a regular product page', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <RouteTracker />
      </MemoryRouter>,
    );
    expect(tracking.pageView).toHaveBeenCalledExactlyOnceWith('/dashboard');
  });
  it.each(['/share/private-share-token', '/published/private-publication/remix', '/reuse/dashboard/private-reference'])(
    'never publishes the private reference in %s',
    path => {
      render(
        <MemoryRouter initialEntries={[`${path}?secret=query-value`]}>
          <RouteTracker />
        </MemoryRouter>,
      );
      const value = tracking.pageView.mock.calls[0][0];
      expect(value).not.toContain('private-');
      expect(value).not.toContain('query-value');
      expect(value).toContain(':reference');
    },
  );
});
