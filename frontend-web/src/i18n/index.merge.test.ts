import { afterEach, describe, expect, it } from 'vitest';
import i18n from './index';
afterEach(async () => {
  await i18n.changeLanguage('ko');
});
describe('merged language resources', () => {
  it('keeps the developed default namespace and main named resources together', async () => {
    await i18n.changeLanguage('ko');
    expect(i18n.options.defaultNS).toBe('translation');
    expect(i18n.t('nav.dashboard')).not.toBe('nav.dashboard');
    expect(i18n.t('actions.save', { ns: 'common' })).toBe('저장');
    for (const namespace of ['auth', 'dashboard', 'database', 'widget']) {
      expect(i18n.hasResourceBundle('ko', namespace)).toBe(true);
      expect(i18n.hasResourceBundle('en', namespace)).toBe(true);
    }
  });
  it('changes both new and retained labels through the same language selection', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('nav.dashboard')).not.toBe('nav.dashboard');
    expect(i18n.t('actions.save', { ns: 'common' })).toBe('Save');
    expect(localStorage.getItem('i18nextLng')).toBe('en');
  });
});
