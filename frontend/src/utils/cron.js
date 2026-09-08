import cronstrue from 'cronstrue/i18n'

export function cronDescription(expr) {
  try {
    return cronstrue.toString(expr, { locale: 'ru', throwExceptionOnParseError: true })
  } catch {
    return null
  }
}
