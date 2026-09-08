import { Box, Typography } from '@mui/material'

/**
 * Restrained Vibe identity: a small geometric voice-wave mark plus a text
 * wordmark. No emoji, no Discord imitation, no gradients or glow — the mark
 * uses only the approved mint action color at varying opacity to suggest a
 * waveform. The shape is purely decorative (aria-hidden); the product name
 * stays real text so it's announced to assistive tech.
 */
export default function BrandMark({ showLabel = true, size = 24 }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: showLabel ? 1.25 : 0, minWidth: 0 }}>
      <Box
        component="svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
        sx={{ width: size, height: size, flexShrink: 0, display: 'block' }}
      >
        <rect
          x="1"
          y="9"
          width="3"
          height="6"
          rx="1.5"
          fill="var(--color-action-primary)"
          opacity="0.5"
        />
        <rect
          x="6.5"
          y="5"
          width="3"
          height="14"
          rx="1.5"
          fill="var(--color-action-primary)"
          opacity="0.75"
        />
        <rect x="12" y="1.5" width="3" height="21" rx="1.5" fill="var(--color-action-primary)" />
        <rect
          x="17.5"
          y="6"
          width="3"
          height="12"
          rx="1.5"
          fill="var(--color-action-primary)"
          opacity="0.75"
        />
      </Box>
      {showLabel && (
        <Typography
          component="span"
          sx={{
            fontFamily: "'Unbounded', sans-serif",
            fontWeight: 700,
            fontSize: '0.95rem',
            letterSpacing: '0.01em',
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          Vibe
        </Typography>
      )}
    </Box>
  )
}
