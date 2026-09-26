import { describe, expect, it } from 'vitest';
import { localeFromParam, localeParam, localeStaticPaths, otherLocale, t } from '../src/lib/i18n';

describe('locale helpers', () => {
  it('maps locales to the optional route prefix', () => {
    expect(localeParam('en')).toBeUndefined();
    expect(localeParam('ru')).toBe('ru');
    expect(localeFromParam(undefined)).toBe('en');
    expect(localeFromParam('ru')).toBe('ru');
    expect(() => localeFromParam('en')).toThrow();
    expect(() => localeFromParam('de')).toThrow();
    expect(localeStaticPaths()).toEqual([
      { params: { locale: undefined }, props: { locale: 'en' } },
      { params: { locale: 'ru' }, props: { locale: 'ru' } },
    ]);
  });

  it('switches to the other locale', () => {
    expect(otherLocale('en')).toBe('ru');
    expect(otherLocale('ru')).toBe('en');
    expect(t('en').languageLabel).toBe('En');
    expect(t('ru').languageLabel).toBe('Ru');
  });

  it('counts lessons with the right plural form', () => {
    expect([1, 2, 5].map(t('en').lessonCount)).toEqual(['1 lesson', '2 lessons', '5 lessons']);
    expect([1, 2, 5, 11, 21, 22].map(t('ru').lessonCount)).toEqual([
      '1 урок',
      '2 урока',
      '5 уроков',
      '11 уроков',
      '21 урок',
      '22 урока',
    ]);
  });

  it('defines every message in both locales', () => {
    expect(Object.keys(t('ru')).toSorted()).toEqual(Object.keys(t('en')).toSorted());
  });
});
