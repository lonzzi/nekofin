import { i18n, t } from './index';

export function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function formatList(values: string[]) {
  if (typeof Intl.ListFormat === 'function')
    return new Intl.ListFormat(i18n.resolvedLanguage, { type: 'conjunction' }).format(values);

  // Hermes does not provide ListFormat on every supported native runtime.
  if (values.length < 2) return values[0] ?? '';
  if (values.length === 2) return t('common.listPair', { first: values[0], second: values[1] });
  return t('common.listEnd', {
    items: values.slice(0, -1).join(t('common.listSeparator')),
    last: values.at(-1),
  });
}
