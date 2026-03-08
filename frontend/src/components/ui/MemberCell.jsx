import { Box, Avatar, Skeleton, Typography } from '@mui/material'
import { DiscordId } from './DiscordId'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.70rem' }

/**
 * Table cell content for a Discord member.
 * Shows skeleton while data is loading (memberData === null).
 * Shows "Unknown" dimmed if member left the server.
 *
 * Props:
 *   id         — discord_id string
 *   memberData — object from useMemberResolver.get(id), or null while loading
 *   showId     — also render <DiscordId> below the username (default false)
 */
export function MemberCell({ id, memberData, showId = false }) {
  if (memberData === null) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Skeleton variant="circular" width={24} height={24} />
        <Box>
          <Skeleton variant="text" width={100} height={14} />
          <Skeleton variant="text" width={70} height={12} />
        </Box>
      </Box>
    )
  }

  const isUnknown = memberData?.display_name === 'Unknown'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 140 }}>
      <Avatar
        src={memberData?.avatar}
        sx={{ width: 24, height: 24, fontSize: '0.65rem', flexShrink: 0 }}
      >
        {memberData?.display_name?.[0]?.toUpperCase()}
      </Avatar>
      <Box>
        <Typography
          sx={{
            fontSize: '0.82rem',
            lineHeight: 1.3,
            color: isUnknown ? 'text.disabled' : 'text.primary',
          }}
        >
          {memberData?.display_name}
        </Typography>
        {memberData?.username && memberData.username !== memberData.display_name && (
          <Typography sx={{ ...MONO, color: 'text.secondary', lineHeight: 1.2 }}>
            @{memberData.username}
          </Typography>
        )}
        {showId && <DiscordId id={id} />}
      </Box>
    </Box>
  )
}
