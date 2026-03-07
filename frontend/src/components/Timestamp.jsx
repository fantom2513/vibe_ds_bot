import { Tooltip } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ru'

dayjs.extend(relativeTime)
dayjs.locale('ru')

export default function Timestamp({ iso }) {
  if (!iso) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  return (
    <Tooltip title={dayjs(iso).format('DD.MM.YYYY HH:mm:ss')}>
      <span
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        {dayjs(iso).fromNow()}
      </span>
    </Tooltip>
  )
}
