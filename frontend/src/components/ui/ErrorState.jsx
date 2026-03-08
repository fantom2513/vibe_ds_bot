import { Alert } from '@mui/material'

export const ErrorState = ({ message }) => (
  <Alert severity="error" sx={{ my: 2 }}>{message}</Alert>
)
