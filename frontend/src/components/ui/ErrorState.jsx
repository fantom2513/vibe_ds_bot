import { Alert, Button } from '@mui/material'

// `onRetry` is optional; when provided, the retry control renders as a
// secondary (outlined, inherit-colored) action — it must never compete with
// the page's actual primary CTA for attention.
export const ErrorState = ({ message, onRetry }) => (
  <Alert
    severity="error"
    sx={{ my: 2 }}
    action={
      onRetry && (
        <Button color="inherit" variant="outlined" size="small" onClick={onRetry}>
          Повторить
        </Button>
      )
    }
  >
    {message}
  </Alert>
)
