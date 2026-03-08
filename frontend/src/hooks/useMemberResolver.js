import { useRef, useCallback, useState } from 'react'
import { membersApi } from '../api/members'

/**
 * Hook for batch-resolving Discord member IDs to display data.
 * Uses an in-memory ref cache to avoid redundant requests.
 *
 * Usage:
 *   const { get, resolveMany } = useMemberResolver()
 *   await resolveMany(['123', '456'])
 *   const data = get('123') // { id, display_name, username, avatar, label }
 */
export function useMemberResolver() {
  const cache = useRef({})
  const [, forceUpdate] = useState(0)

  const resolveMany = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return

    const missing = ids
      .map(String)
      .filter(id => id && !(id in cache.current))

    if (missing.length === 0) return

    // Optimistically mark as loading (null sentinel)
    missing.forEach(id => { cache.current[id] = null })

    try {
      const result = await membersApi.batch(missing)
      Object.assign(cache.current, result)
    } catch {
      // Silent fail: fill with Unknown stubs
      missing.forEach(id => {
        cache.current[id] = {
          id,
          display_name: 'Unknown',
          username: id,
          avatar: null,
          label: `Unknown (@${id})`,
        }
      })
    }

    forceUpdate(n => n + 1)
  }, [])

  const get = useCallback((id) => {
    return cache.current[String(id)] ?? null
  }, [])

  return { get, resolveMany }
}
