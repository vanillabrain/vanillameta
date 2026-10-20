import React from 'react';
import { renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingContext } from '@/contexts/LoadingContext';
import { useShareDashboard } from './useShareDashboard';

const mocks = vi.hoisted(() => ({ select: vi.fn(), error: vi.fn(), show: vi.fn(), hide: vi.fn() }));
vi.mock('@/components/loading', () => ({ Loading: () => null }));
vi.mock('@/api/shareService', () => ({ default: { selectDashboard: mocks.select } }));
vi.mock('react-alert', () => ({ useAlert: () => ({ error: mocks.error }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('shared dashboard error feedback', () => {
  it.each(['expired date', { message: 'expired date' }])('recognizes expired share response %j', async data => {
    mocks.select.mockRejectedValueOnce({ response: { status: 401, data: { data } } });
    const { result } = renderHook(() => useShareDashboard('expired-fixture'), {
      wrapper: ({ children }) => (
        <LoadingContext.Provider value={{ loading: false, showLoading: mocks.show, hideLoading: mocks.hide }}>
          {children}
        </LoadingContext.Provider>
      ),
    });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('share.expired'));
    expect(result.current.isInvalidData).toBe(401);
    expect(result.current.dashboardInfo.widgets).toEqual([]);
    expect(mocks.hide).toHaveBeenCalledOnce();
  });
});
