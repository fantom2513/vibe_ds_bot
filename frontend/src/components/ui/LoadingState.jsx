import { Box, LinearProgress, Typography } from '@mui/material'

// role="status" + aria-live so assistive tech announces the concise text
// immediately, without waiting for the loading region to gain focus.
export const LoadingState = ({ text = 'Загрузка…' }) => (
  <Box role="status" aria-live="polite" sx={{ py: 8, textAlign: 'center' }}>
    <LinearProgress sx={{ maxWidth: 200, mx: 'auto', mb: 2, borderRadius: 2 }} />
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {text}
    </Typography>
  </Box>
)
