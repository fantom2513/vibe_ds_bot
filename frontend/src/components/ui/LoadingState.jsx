import { Box, LinearProgress, Typography } from '@mui/material'

export const LoadingState = ({ text = 'Загрузка...' }) => (
  <Box sx={{ py: 8, textAlign: 'center' }}>
    <LinearProgress sx={{ maxWidth: 200, mx: 'auto', mb: 2, borderRadius: 2 }} />
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {text}
    </Typography>
  </Box>
)
