import { Box, Typography } from '@mui/material'

export const EmptyState = ({ text = 'Нет данных', icon = '🔍' }) => (
  <Box sx={{ py: 8, textAlign: 'center' }}>
    <Typography sx={{ fontSize: '2rem', mb: 1 }}>{icon}</Typography>
    <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
      {text}
    </Typography>
  </Box>
)
