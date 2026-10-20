import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import PublishedRoute, { publicationKind } from './PublishedRoute';
vi.mock('@/layouts/PublicLayout', () => ({
  default: ({ children }: React.PropsWithChildren) => <div data-testid="public-layout">{children}</div>,
}));
vi.mock('@/pages/Dashboard/Studio/PublishedDashboard', () => ({ default: () => <p>Studio {useParams().token}</p> }));
vi.mock('@/pages/Publication/Published', () => ({ default: () => <p>Analysis {useParams().token}</p> }));
afterEach(cleanup);
const studioToken = 'a'.repeat(64),
  analysisToken = 'b8d62c69-0260-4d3d-a01a-4dc251120e03';
function open(token: string) {
  render(
    <MemoryRouter initialEntries={['/published/' + token]}>
      <Routes>
        <Route path="/published/:token" element={<PublishedRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}
it('keeps issued Studio links on the Studio viewer without the analysis layout', async () => {
  open(studioToken);
  await screen.findByText('Studio ' + studioToken);
  expect(screen.queryByTestId('public-layout')).toBeNull();
  expect(screen.queryByText(/^Analysis/)).toBeNull();
});
it('keeps issued UUID links on the analysis snapshot viewer with its public layout', async () => {
  open(analysisToken);
  await screen.findByText('Analysis ' + analysisToken);
  expect(screen.getByTestId('public-layout')).toBeDefined();
  expect(screen.queryByText(/^Studio/)).toBeNull();
});
it.each(['invalid', 'a'.repeat(63), 'b8d62c69-0260-4d3d-a01a', 'javascript:alert(1)'])(
  'rejects malformed IDs without trying either viewer: %s',
  token => {
    expect(publicationKind(token)).toBe('invalid');
    open(token);
    expect(screen.getByRole('alert').textContent).toContain('게시 링크');
    expect(screen.queryByText(/^(Studio|Analysis)/)).toBeNull();
  },
);
