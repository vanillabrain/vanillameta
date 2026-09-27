import { WIDGET_TYPE } from '@/constant';
import { NO_COMPONENT_MESSAGE, renderWidgetViewer, WIDGET_VIEWERS } from './viewerRegistry';
import { renderWidgetSetting, WIDGET_SETTINGS } from './settingRegistry';

const widgetTypes = Object.values(WIDGET_TYPE);

describe('widget registries', () => {
  it('모든 WIDGET_TYPE 에 뷰어가 등록되어 있다', () => {
    const missing = widgetTypes.filter(type => !WIDGET_VIEWERS[type]);
    expect(missing).toEqual([]);
  });

  it('모든 WIDGET_TYPE 에 설정 컴포넌트가 등록되어 있다', () => {
    const missing = widgetTypes.filter(type => !WIDGET_SETTINGS[type]);
    expect(missing).toEqual([]);
  });

  it('등록된 타입은 노드를 반환한다', () => {
    expect(renderWidgetViewer(WIDGET_TYPE.CHART_LINE, { option: {}, dataSet: [] })).not.toBe(
      NO_COMPONENT_MESSAGE,
    );
    expect(
      renderWidgetSetting(WIDGET_TYPE.CHART_PIE, {
        option: {},
        setOption: () => undefined,
        spec: null,
        dataSet: [],
      }),
    ).not.toBe(NO_COMPONENT_MESSAGE);
  });

  it('알 수 없는 타입은 안내 문자열을 반환한다', () => {
    expect(renderWidgetViewer('UNKNOWN_TYPE', { option: {}, dataSet: [] })).toBe(
      NO_COMPONENT_MESSAGE,
    );
    expect(
      renderWidgetSetting('UNKNOWN_TYPE', {
        option: {},
        setOption: () => undefined,
        spec: null,
        dataSet: [],
      }),
    ).toBe(NO_COMPONENT_MESSAGE);
  });
});
