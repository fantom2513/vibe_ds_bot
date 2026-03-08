import { useState, useRef, useCallback } from 'react'
import { Autocomplete, TextField, Avatar, Box, Typography, CircularProgress } from '@mui/material'
import { membersApi } from '../../api/members'

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.70rem' }

/**
 * Autocomplete for Discord server members.
 * Searches via /api/members?q= with 250ms debounce (no lodash).
 * Server-side filtering — filterOptions passes through all results.
 *
 * Props:
 *   value       — selected discord_id string | null
 *   onChange(id) — called with discord_id string when selection changes
 *   label       — TextField label
 *   error       — boolean
 *   helperText  — string
 *   disabled    — boolean
 */
export function MemberAutocomplete({ value, onChange, label, error, helperText, disabled }) {
  const [options, setOptions] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const debounceTimer = useRef(null)

  const fetchOptions = useCallback((q) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await membersApi.search(q, 50)
        setOptions(results)
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    }, 250)
  }, [])

  const selectedOption = options.find(o => o.id === value) ?? null

  const displayHelperText = value
    ? (helperText || `ID: ${value}`)
    : helperText

  return (
    <Autocomplete
      options={options}
      value={selectedOption}
      inputValue={inputValue}
      filterOptions={x => x}
      loading={loading}
      disabled={disabled}
      getOptionLabel={opt => opt.label || opt.display_name || ''}
      isOptionEqualToValue={(opt, val) => opt.id === val?.id}
      onOpen={() => fetchOptions('')}
      onInputChange={(_, newInput, reason) => {
        setInputValue(newInput)
        if (reason === 'input') fetchOptions(newInput)
      }}
      onChange={(_, newValue) => {
        onChange(newValue?.id ?? null)
      }}
      renderOption={(props, opt) => (
        <Box component="li" {...props} key={opt.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '6px !important' }}>
          <Avatar src={opt.avatar} sx={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0 }}>
            {opt.display_name?.[0]?.toUpperCase()}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.3 }}>{opt.display_name}</Typography>
            {opt.username !== opt.display_name && (
              <Typography sx={{ ...MONO, color: 'text.secondary', lineHeight: 1.2 }}>@{opt.username}</Typography>
            )}
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size="small"
          error={error}
          helperText={displayHelperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading && <CircularProgress size={14} sx={{ mr: 1 }} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  )
}
