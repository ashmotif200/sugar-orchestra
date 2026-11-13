import fr from './fr.json'
import en from './en.json'

export type Lang = 'fr' | 'en'
const DICTS: Record<Lang, unknown> = { fr, en }

let lang: Lang = 'fr'

export function setLang(l: Lang) { lang = l }
export function getLang(): Lang { return lang }

/** t('step.add'), with {n} style interpolation. Missing keys return the key. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const walk = (dict: unknown): unknown =>
    key.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), dict)
  let value = walk(DICTS[lang])
  if (typeof value !== 'string') value = walk(DICTS.fr)
  if (typeof value !== 'string') return key
  return vars ? value.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : value
}

/** Enum of every key, for the type-checked call sites below (loose on purpose). */
export type TKey = string
