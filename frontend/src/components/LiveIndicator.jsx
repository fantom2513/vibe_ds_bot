import { useState, useEffect } from 'react'
import { getApiBaseUrl, getApiKey } from '../lib/storage'

export default function LiveIndicator() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const key = getApiKey()
    if (!key) {
      setConnected(false)
      return
    }
    const base = getApiBaseUrl().replace(/^http/, 'ws').replace(/\/$/, '')
    const wsUrl = `${base}/api/ws/live`
    let ws = null
    let timeout = null
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => setConnected(true)
        ws.onclose = () => {
          setConnected(false)
          timeout = setTimeout(connect, 5000)
        }
        ws.onerror = () => ws?.close()
      } catch (_) {
        setConnected(false)
      }
    }
    connect()
    return () => {
      if (timeout) clearTimeout(timeout)
      ws?.close()
    }
  }, [])

  return (
    <span className={`live-badge ${connected ? '' : 'off'}`} title={connected ? 'WebSocket подключён' : 'WebSocket не подключён (эндпоинт может быть не реализован)'}>
      <span className="live-dot" />
      {connected ? 'Live' : 'Offline'}
    </span>
  )
}
