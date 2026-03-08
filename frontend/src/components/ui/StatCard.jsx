import { Box, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import { GlowCard } from './GlowCard'
import { cardVariants } from '../../styles/motion'

export const StatCard = ({ title, value, icon: Icon, color = '#5865F2', glowColor = 'accent', trend, index = 0 }) => (
  <motion.div
    variants={cardVariants}
    initial="initial"
    animate="animate"
    custom={index}
  >
    <GlowCard glowColor={glowColor} sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="overline" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
            {title}
          </Typography>
          <Typography sx={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '2rem',
            fontWeight: 500,
            lineHeight: 1,
            color: 'text.primary',
            letterSpacing: '-0.02em',
          }}>
            {value ?? '—'}
          </Typography>
          {trend != null && (
            <Typography variant="caption" sx={{
              color: trend > 0 ? 'var(--green)' : 'var(--red)',
              mt: 0.5,
              display: 'block',
            }}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}% за неделю
            </Typography>
          )}
        </Box>
        {Icon && (
          <Box sx={{
            width: 40, height: 40, borderRadius: 2,
            backgroundColor: `${color}18`,
            border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color,
            boxShadow: `0 0 16px ${color}20`,
            flexShrink: 0,
          }}>
            <Icon sx={{ fontSize: 18 }} />
          </Box>
        )}
      </Box>
    </GlowCard>
  </motion.div>
)
