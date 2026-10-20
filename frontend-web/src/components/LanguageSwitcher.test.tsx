import { vi, afterEach } from 'vitest';
afterEach(cleanup);
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import LanguageSwitcher from './LanguageSwitcher';

// react-i18next 모킹
const { mockChangeLanguage, mockI18n } = vi.hoisted(() => {
  const mockChangeLanguage = vi.fn();
  return { mockChangeLanguage, mockI18n: { changeLanguage: mockChangeLanguage, language: 'ko' } };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: mockI18n,
    t: (key: string) => key,
  }),
}));

describe('LanguageSwitcher 컴포넌트', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockI18n.language = 'ko';
  });

  it('언어 선택 버튼이 렌더링되어야 함', () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    expect(document.contains(button)).toBe(true);

    // LanguageIcon이 있는지 확인
    const icon = button.querySelector('svg');
    expect(document.contains(icon)).toBe(true);
  });

  it('버튼 클릭 시 메뉴가 열려야 함', async () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.contains(screen.getByText('한국어'))).toBe(true);
      expect(document.contains(screen.getByText('English'))).toBe(true);
    });
  });

  it('현재 언어가 선택된 상태로 표시되어야 함', async () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const koreanMenuItem = screen.getByRole('menuitem', { name: /한국어/ });
      expect((koreanMenuItem as Element).classList.contains('Mui-selected')).toBe(true);
    });
  });

  it('언어 선택 시 changeLanguage가 호출되어야 함', async () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const englishMenuItem = screen.getByText('English');
      expect(document.contains(englishMenuItem)).toBe(true);
    });

    const englishMenuItem = screen.getByText('English');
    fireEvent.click(englishMenuItem);

    expect(mockChangeLanguage).toHaveBeenCalledWith('en');
  });

  it('언어 변경 후 메뉴가 닫혀야 함', async () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.contains(screen.getByText('English'))).toBe(true);
    });

    const englishMenuItem = screen.getByText('English');
    fireEvent.click(englishMenuItem);

    await waitFor(() => {
      expect(document.contains(screen.queryByText('English'))).toBe(false);
    });
  });

  it('각 언어에 플래그가 표시되어야 함', async () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.contains(screen.getByText('🇰🇷'))).toBe(true);
      expect(document.contains(screen.getByText('🇺🇸'))).toBe(true);
    });
  });

  it('영어가 현재 언어일 때 올바르게 표시되어야 함', async () => {
    mockI18n.language = 'en';

    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const englishMenuItem = screen.getByRole('menuitem', { name: /English/ });
      expect((englishMenuItem as Element).classList.contains('Mui-selected')).toBe(true);
    });
  });

  it('메뉴 외부 클릭 시 메뉴가 닫혀야 함', async () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(document.contains(screen.getByText('한국어'))).toBe(true);
    });

    // Material-UI Menu의 backdrop 클릭으로 메뉴 닫기
    const backdrop = screen.getByRole('presentation').querySelector('.MuiBackdrop-root');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    await waitFor(() => {
      expect(document.contains(screen.queryByText('한국어'))).toBe(false);
    });
  });

  it('알 수 없는 언어 코드일 때 기본값(한국어)이 선택되어야 함', async () => {
    mockI18n.language = 'unknown';

    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const koreanMenuItem = screen.getByRole('menuitem', { name: /한국어/ });
      expect((koreanMenuItem as Element).classList.contains('Mui-selected')).toBe(true);
    });
  });

  it('메뉴 아이템에 올바른 스타일이 적용되어야 함', async () => {
    render(<LanguageSwitcher />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const menuItems = screen.getAllByRole('menuitem');
      menuItems.forEach(item => {
        const box = item.querySelector('[class*="MuiBox-root"]');
        expect(getComputedStyle(box).display).toBe('flex');
        expect(getComputedStyle(box).alignItems).toBe('center');
      });
    });
  });
});
