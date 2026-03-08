import { Card } from '@mui/material'
import { motion } from 'framer-motion'

const GLOW = {
  accent: 'rgba(88,101,242,0.20)',
  green:  'rgba(34,211,165,0.15)',
  red:    'rgba(244,63,94,0.15)',
  purple: 'rgba(139,92,246,0.15)',
}

export const GlowCard = ({ children, glowColor = 'accent', sx, ...props }) => (
  <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
    <Card
      sx={{
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.25s, box-shadow 0.25s',
        '&:hover': {
          borderColor: 'rgba(255,255,255,0.14)',
          boxShadow: `0 0 30px ${GLOW[glowColor]}, 0 8px 32px rgba(0,0,0,0.6)`,
        },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Card>
  </motion.div>
)
