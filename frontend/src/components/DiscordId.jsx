import { Typography } from 'antd'

export default function DiscordId({ id }) {
  return (
    <Typography.Text
      copyable
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 11,
        color: 'var(--text-mono)',
      }}
    >
      {id}
    </Typography.Text>
  )
}
