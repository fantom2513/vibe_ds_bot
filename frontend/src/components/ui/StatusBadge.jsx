import { Box } from '@mui/material'

// Tone -> exact rgba tints of the approved status tokens (mint / sky / amber
// / rose / neutral-300), matching the same values theme.js already uses for
// MuiAlert's standardSuccess/standardWarning/standardError/standardInfo
// overrides. Tone is the only public knob — callers cannot pass raw colors.
const TONE = {
  success: {
    fg: 'var(--color-status-success)',
    bg: 'rgba(101,198,156,0.10)',
    border: 'rgba(101,198,156,0.30)',
  },
  info: {
    fg: 'var(--color-status-info)',
    bg: 'rgba(103,185,222,0.10)',
    border: 'rgba(103,185,222,0.30)',
  },
  warning: {
    fg: 'var(--color-status-warning)',
    bg: 'rgba(221,184,104,0.10)',
    border: 'rgba(221,184,104,0.30)',
  },
  danger: {
    fg: 'var(--color-status-danger)',
    bg: 'rgba(229,138,148,0.10)',
    border: 'rgba(229,138,148,0.30)',
  },
  neutral: {
    fg: 'var(--color-text-secondary)',
    bg: 'rgba(168,181,176,0.10)',
    border: 'var(--color-border)',
  },
}

export const StatusBadge = ({ tone = 'neutral', dot = false, children, sx }) => {
  const c = TONE[tone] || TONE.neutral
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        px: 1,
        py: '2px',
        borderRadius: '5px',
        border: `1px solid ${c.border}`,
        backgroundColor: c.bg,
        color: c.fg,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '0.70rem',
        fontWeight: 500,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        ...sx,
      }}
    >
      {dot && (
        <Box
          component="span"
          aria-hidden="true"
          sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: c.fg, flexShrink: 0 }}
        />
      )}
      {children}
    </Box>
  )
}
