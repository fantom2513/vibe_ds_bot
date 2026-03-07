const ACTION_COLORS = {
  mute:      { bg: '#2a1f0a', border: '#f59e0b', text: '#f59e0b' },
  unmute:    { bg: '#0a2018', border: '#23c55e', text: '#23c55e' },
  move:      { bg: '#0a1628', border: '#3b82f6', text: '#3b82f6' },
  kick:      { bg: '#280a0a', border: '#ef4444', text: '#ef4444' },
  kick_timeout: { bg: '#280a0a', border: '#ef4444', text: '#ef4444' },
  pair_move: { bg: '#1a0f2e', border: '#8b5cf6', text: '#8b5cf6' },
  dry_run:   { bg: '#151618', border: '#6b7280', text: '#6b7280' },
}

export default function ActionTag({ type, isDryRun }) {
  const colors = ACTION_COLORS[isDryRun ? 'dry_run' : type] || ACTION_COLORS.dry_run
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: 4,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        color: colors.text,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      {isDryRun ? `${type} · DRY` : type}
    </span>
  )
}
