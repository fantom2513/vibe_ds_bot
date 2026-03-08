import { Box } from '@mui/material'

const CONFIG = {
  mute:          { bg: 'rgba(251,191,36,0.10)',  border: 'rgba(251,191,36,0.30)',  color: '#fbbf24' },
  unmute:        { bg: 'rgba(34,211,165,0.10)',  border: 'rgba(34,211,165,0.30)',  color: '#22d3a5' },
  move:          { bg: 'rgba(56,189,248,0.10)',  border: 'rgba(56,189,248,0.30)',  color: '#38bdf8' },
  kick:          { bg: 'rgba(244,63,94,0.10)',   border: 'rgba(244,63,94,0.30)',   color: '#f43f5e' },
  kick_timeout:  { bg: 'rgba(244,63,94,0.10)',   border: 'rgba(244,63,94,0.30)',   color: '#f43f5e' },
  pair_move:     { bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.30)',  color: '#8b5cf6' },
  dry_run:       { bg: 'rgba(71,85,105,0.15)',   border: 'rgba(71,85,105,0.30)',   color: '#475569' },
}

export const ActionChip = ({ type, isDryRun }) => {
  const key = isDryRun ? 'dry_run' : (type || 'dry_run')
  const c = CONFIG[key] || CONFIG.dry_run
  return (
    <Box component="span" sx={{
      display: 'inline-block',
      px: 1, py: '2px',
      borderRadius: '5px',
      border: `1px solid ${c.border}`,
      backgroundColor: c.bg,
      color: c.color,
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: '0.70rem',
      fontWeight: 500,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      {isDryRun ? `${type} · DRY` : type}
    </Box>
  )
}
