import { Box, Card, Typography } from '@mui/material'
import { motion, useReducedMotion } from 'framer-motion'
import { cardVariants } from '../../styles/motion'

// Semantic tone only — no raw `color`/`glowColor` props. Most stat cards
// should stay neutral; a tone is for the rare card that genuinely reflects a
// live/positive/warning state (see Dashboard's "in voice now" card).
const TONE_COLORS = {
  success: 'var(--color-status-success)',
  info: 'var(--color-status-info)',
  warning: 'var(--color-status-warning)',
  danger: 'var(--color-status-danger)',
  neutral: 'var(--color-text-secondary)',
}

export const StatCard = ({ tone = 'neutral', label, value, meta, icon: Icon, index = 0 }) => {
  const reduceMotion = useReducedMotion()
  const accent = TONE_COLORS[tone] || TONE_COLORS.neutral

  return (
    <motion.div
      variants={cardVariants}
      initial={reduceMotion ? false : 'initial'}
      animate={reduceMotion ? false : 'animate'}
      custom={index}
    >
      <Card sx={{ p: 2.5, height: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              {label}
            </Typography>
            <Typography sx={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '2rem',
              fontWeight: 500,
              lineHeight: 1,
              color: 'text.primary',
              letterSpacing: '-0.02em',
            }}>
              {value ?? '—'}
            </Typography>
            {meta != null && (
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                {meta}
              </Typography>
            )}
          </Box>
          {Icon && (
            <Box sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: accent,
              flexShrink: 0,
            }}>
              <Icon sx={{ fontSize: 18 }} />
            </Box>
          )}
        </Box>
      </Card>
    </motion.div>
  )
}
