import { useRef } from 'react'
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'

let idCounter = 0

// Shared destructive-confirmation recipe. While `busy`, both actions are
// disabled and Escape/backdrop dismissal is rejected (the caller's
// `onCancel` is simply never invoked) so a pending delete cannot be
// interrupted mid-flight. `busyLabel` lets a caller show a specific
// in-progress verb (e.g. "Удаление…" for a delete confirmation) distinct
// from the idle `confirmLabel`; it defaults to `${confirmLabel}…` when a
// caller doesn't need anything more specific.
export const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = 'Удалить',
  busyLabel,
  busy = false,
  onCancel,
  onConfirm,
}) => {
  const titleId = useRef(`confirm-dialog-title-${++idCounter}`).current
  const descriptionId = useRef(`confirm-dialog-description-${++idCounter}`).current

  const handleDismiss = () => {
    if (busy) return
    onCancel?.()
  }

  return (
    <Dialog
      open={open}
      onClose={handleDismiss}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {description && (
        <DialogContent>
          <DialogContentText id={descriptionId}>{description}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button variant="text" onClick={handleDismiss} disabled={busy}>
          Отмена
        </Button>
        <Button
          variant="contained"
          color="error"
          onClick={() => {
            if (!busy) onConfirm?.()
          }}
          disabled={busy}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {busy ? busyLabel || `${confirmLabel}…` : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
