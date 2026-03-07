import { Card } from 'antd'

export default function StatCard({ title, value, icon, color = 'var(--accent)' }) {
  return (
    <Card
      style={{ borderColor: 'var(--border-base)' }}
      styles={{ body: { padding: '16px 20px' } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'Syne, sans-serif',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 32,
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 500,
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {value}
          </div>
        </div>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fontSize: 16,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  )
}
