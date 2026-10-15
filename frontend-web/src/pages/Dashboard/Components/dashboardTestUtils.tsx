import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

/**
 * Dashboard 테스트 전용 헬퍼.
 *
 * 실제 설치된 Radix 기반 shadcn 컨트롤을 JSDOM에서 조작하기 위해 필요한
 * 브라우저 API와 상호작용 절차를 제공한다. 프로덕션 코드는 이 모듈에 의존하지 않는다.
 */
export function installRadixBrowserAPIs() {
  const proto = Element.prototype as any;
  proto.hasPointerCapture = proto.hasPointerCapture ?? (() => false);
  proto.setPointerCapture = proto.setPointerCapture ?? (() => undefined);
  proto.releasePointerCapture = proto.releasePointerCapture ?? (() => undefined);
  proto.scrollIntoView = proto.scrollIntoView ?? (() => undefined);
  const globals = globalThis as any;
  globals.ResizeObserver =
    globals.ResizeObserver ??
    // JSDOM에는 레이아웃이 없으므로 관찰 대상은 없지만, Radix가 요구하는 API 표면은 갖춘다.
    class ResizeObserverStub {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    };
}

/** 실제 Radix Select 트리거를 열고 리스트박스가 나타날 때까지 기다린다. */
export async function openRadixSelect(trigger: HTMLElement) {
  await userEvent.click(trigger);
  await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'));
  return screen.getByRole('listbox');
}

/** 실제 Radix Select에서 옵션을 골라 컨트롤 값을 바꾼다(네이티브 change 이벤트가 아니다). */
export async function selectRadixOption(trigger: HTMLElement, optionName: string | RegExp) {
  await openRadixSelect(trigger);
  await userEvent.click(await screen.findByRole('option', { name: optionName }));
  await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
}

/** Tailwind 임의값/유틸리티 클래스로 표현된 스타일을 확인한다(인라인 style이 사라진 구현용). */
export function classNamesOf(element: Element) {
  return element.className.split(' ').filter(Boolean);
}
