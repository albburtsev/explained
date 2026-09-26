export const locales = ['en', 'ru'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

const messages = {
  en: {
    languageName: 'English',
    languageLabel: 'En',
    switchLanguage: 'Switch to English',
    siteTagline: 'A personal knowledge base',
    siteDescription: 'A personal knowledge base built from structured Markdown.',
    skipToContent: 'Skip to content',
    homeLabel: 'Explained home',
    viewSource: 'View source',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    switchToLightTheme: 'Switch to light theme',
    switchToDarkTheme: 'Switch to dark theme',
    home: 'Home',
    courses: 'Courses',
    coursesDescription: 'Browse every course in the Explained knowledge base.',
    coursesIntro: 'Structured paths through the subjects worth understanding.',
    course: 'Course',
    lessons: 'Lessons',
    topics: 'Topics',
    breadcrumb: 'Breadcrumb',
    lessonNavigation: 'Lesson navigation',
    previousLesson: 'Previous lesson',
    nextLesson: 'Next lesson',
    courseComplete: 'Course complete',
    backToCourse: (title: string) => `Back to ${title}`,
    lessonPosition: (position: number, total: number) => `Lesson ${position} of ${total}`,
    lessonCount: (count: number) => `${count} ${count === 1 ? 'lesson' : 'lessons'}`,
    searchLabel: 'Search the knowledge base',
    searchPlaceholder: 'Search',
    searchStart: 'Start typing to search.',
    searchTooShort: 'Type at least two characters.',
    searchLoading: 'Loading search index…',
    searchUnavailable: 'Search is temporarily unavailable.',
    searchNoResults: (query: string) => `No results for “${query}”.`,
    searchKind: { course: 'course', lesson: 'lesson' },
    copyCode: 'Copy code',
    copied: 'Copied',
    copyFailed: 'Copy failed',
  },
  ru: {
    languageName: 'Русский',
    languageLabel: 'Ru',
    switchLanguage: 'Переключить на русский',
    siteTagline: 'Личная база знаний',
    siteDescription: 'Личная база знаний, собранная из структурированного Markdown.',
    skipToContent: 'Перейти к содержимому',
    homeLabel: 'Explained, главная страница',
    viewSource: 'Исходный код',
    lightTheme: 'Светлая',
    darkTheme: 'Тёмная',
    switchToLightTheme: 'Включить светлую тему',
    switchToDarkTheme: 'Включить тёмную тему',
    home: 'Главная',
    courses: 'Курсы',
    coursesDescription: 'Все курсы базы знаний Explained.',
    coursesIntro: 'Последовательные маршруты по темам, в которых стоит разобраться.',
    course: 'Курс',
    lessons: 'Уроки',
    topics: 'Темы',
    breadcrumb: 'Навигационная цепочка',
    lessonNavigation: 'Навигация по урокам',
    previousLesson: 'Предыдущий урок',
    nextLesson: 'Следующий урок',
    courseComplete: 'Курс пройден',
    backToCourse: (title: string) => `Вернуться к курсу «${title}»`,
    lessonPosition: (position: number, total: number) => `Урок ${position} из ${total}`,
    lessonCount: (count: number) => `${count} ${russianPlural(count, 'урок', 'урока', 'уроков')}`,
    searchLabel: 'Поиск по базе знаний',
    searchPlaceholder: 'Поиск',
    searchStart: 'Начните вводить запрос.',
    searchTooShort: 'Введите хотя бы два символа.',
    searchLoading: 'Загружаем поисковый индекс…',
    searchUnavailable: 'Поиск временно недоступен.',
    searchNoResults: (query: string) => `По запросу «${query}» ничего не найдено.`,
    searchKind: { course: 'курс', lesson: 'урок' },
    copyCode: 'Скопировать код',
    copied: 'Скопировано',
    copyFailed: 'Не удалось скопировать',
  },
} satisfies Record<Locale, unknown>;

export type Messages = (typeof messages)[Locale];

const russianPluralRules = new Intl.PluralRules('ru');

function russianPlural(count: number, one: string, few: string, many: string): string {
  const category = russianPluralRules.select(count);
  if (category === 'one') return one;
  if (category === 'few') return few;
  return many;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

export function t(locale: Locale): Messages {
  return messages[locale];
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'ru' : 'en';
}

/** Route parameter for the optional locale prefix: the default locale has none. */
export function localeParam(locale: Locale): string | undefined {
  return locale === defaultLocale ? undefined : locale;
}

export function localeFromParam(param: string | undefined): Locale {
  if (param === undefined) return defaultLocale;
  if (!isLocale(param) || param === defaultLocale) throw new Error(`Unsupported locale route prefix: ${param}`);
  return param;
}

export function documentLocale(): Locale {
  const lang = globalThis.document?.documentElement.lang;
  return isLocale(lang) ? lang : defaultLocale;
}

/** Static paths for pages under the optional `[...locale]` route prefix. */
export function localeStaticPaths() {
  return locales.map((locale) => ({ params: { locale: localeParam(locale) }, props: { locale } }));
}
