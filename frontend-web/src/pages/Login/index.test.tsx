import React from 'react';
import '@testing-library/jest-dom';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import Login from './index';

describe('Login 페이지', () => {
  it('아이디/비밀번호 입력과 로그인 버튼을 렌더링한다', () => {
    renderWithProviders(<Login />, { route: '/login' });

    expect(screen.getByLabelText(/User ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });
});
