import { Box, Typography } from '@mui/material'

// `icon` is a component (an @mui/icons-material icon), never an emoji
// string — emoji render as literal text glyphs, which is both inconsistent
// with the icon set used everywhere else and reads as noise to screen readers.
export const EmptyState = ({ text = 'Нет данных', icon: Icon }) => (
  <Box sx={{ py: 8, textAlign: 'center' }}>
    {Icon && <Icon sx={{ fontSize: '2rem', color: 'text.secondary', mb: 1 }} />}
    <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
      {text}
    </Typography>
  </Box>
)
