import { Box, Typography } from '@mui/material'

// Plain, neutral content surface: a one-pixel border and the surface
// background token, nothing else. No hover treatment — Panel is a layout
// primitive, not a button; a caller that wants an interactive panel should
// apply its own hover styles via `sx`, not get one implicitly here.
export const Panel = ({ title, description, action, children, sx }) => (
  <Box
    sx={{
      border: '1px solid var(--color-border)',
      borderRadius: 2,
      backgroundColor: 'var(--color-bg-surface)',
      overflow: 'hidden',
      ...sx,
    }}
  >
    {(title || description || action) && (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          px: 2.5,
          py: 2,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          {title && (
            // A real heading (not styled text) — panels sit under the page's
            // h3 (e.g. Dashboard's "Обзор сервера"), so h4 keeps the document
            // outline non-skipping without pulling in Unbounded (h4+ stay on
            // the body typeface per theme.js).
            <Typography component="h4" sx={{ color: 'text.primary', fontWeight: 600, fontSize: '0.92rem', m: 0 }}>
              {title}
            </Typography>
          )}
          {description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
              {description}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Box>
    )}
    <Box sx={{ p: 2.5 }}>{children}</Box>
  </Box>
)
