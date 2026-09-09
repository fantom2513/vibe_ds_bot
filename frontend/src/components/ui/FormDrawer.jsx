import { useEffect, useRef } from 'react'
import { Box, Button, CircularProgress, Drawer, Typography } from '@mui/material'

let idCounter = 0

// Shared create/edit drawer recipe: a real <form> so Enter-to-submit works
// natively, a pending-state-protected action bar pinned to the bottom, and
// an accessible dialog name derived from `title` (via aria-labelledby) so
// callers can assert `getByRole('dialog', { name: title })`. `onClose` is
// intentionally never invoked while `submitting` is true — MUI's Drawer
// still fires Escape/backdrop dismissal internally, so this component must
// swallow those calls itself rather than relying on the caller to no-op.
export const FormDrawer = ({
  open,
  title,
  onClose,
  onSubmit,
  submitting = false,
  submitLabel = 'Сохранить',
  width = 480,
  children,
}) => {
  const titleId = useRef(`form-drawer-title-${++idCounter}`).current
  const formRef = useRef(null)

  // Focus the first real field once the drawer's content has mounted. A
  // macrotask delay lets MUI's own FocusTrap finish its initial-focus pass
  // first, so this effect's explicit focus() call is the one that wins.
  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(() => {
      const root = formRef.current
      if (!root) return
      const field = root.querySelector(
        'input:not([type="hidden"]), textarea, [role="combobox"], select, [tabindex]:not([tabindex="-1"])'
      )
      field?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [open])

  const handleDismiss = () => {
    if (submitting) return
    onClose?.()
  }

  const handleSubmit = event => {
    event.preventDefault()
    if (!submitting) onSubmit?.()
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleDismiss}
      PaperProps={{
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': titleId,
        sx: { width: `min(100vw, ${width}px)` },
      }}
    >
      <Box
        component="form"
        noValidate
        ref={formRef}
        onSubmit={handleSubmit}
        sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography
            id={titleId}
            component="h2"
            variant="h6"
            sx={{ fontSize: '1rem', color: 'text.primary' }}
          >
            {title}
          </Typography>
        </Box>
        <Box sx={{ px: 3, pb: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {children}
        </Box>
        <Box
          sx={{
            p: 2,
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
          }}
        >
          <Button variant="text" onClick={handleDismiss} disabled={submitting}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {submitting ? 'Сохранение…' : submitLabel}
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}
