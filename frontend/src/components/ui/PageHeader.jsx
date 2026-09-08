import { Box, Typography, Divider } from '@mui/material'

export const PageHeader = ({ title, subtitle, actions }) => (
  <Box sx={{ mb: 3 }}>
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'stretch', sm: 'flex-start' },
        gap: 1.5,
        mb: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ color: 'text.primary', mb: 0.5 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>{actions}</Box>}
    </Box>
    <Divider />
  </Box>
)
