import { Tooltip, Typography } from '@mui/material'
import { useState } from 'react'

export const DiscordId = ({ id }) => {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Tooltip title={copied ? '✓ Скопировано' : 'Нажми чтобы скопировать'}>
      <Typography
        onClick={copy}
        sx={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '0.72rem',
          color: 'var(--text-mono)',
          cursor: 'pointer',
          display: 'inline-block',
          transition: 'color 0.15s',
          '&:hover': { color: '#f0f2ff' },
        }}
      >
        {id}
      </Typography>
    </Tooltip>
  )
}
