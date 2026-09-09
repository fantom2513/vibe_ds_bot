import { StatusBadge } from './StatusBadge'

// Action type -> semantic tone. Previously ActionChip carried its own map of
// raw hex colors; it now composes StatusBadge so every status pill in the
// app (chips and badges alike) draws from the same approved token set.
const TONE_BY_TYPE = {
  mute: 'warning',
  unmute: 'success',
  move: 'info',
  kick: 'danger',
  kick_timeout: 'danger',
  pair_move: 'neutral',
}

export const ActionChip = ({ type, isDryRun }) => {
  const tone = isDryRun ? 'neutral' : TONE_BY_TYPE[type] || 'neutral'
  return <StatusBadge tone={tone}>{isDryRun ? `${type} · DRY` : type}</StatusBadge>
}
