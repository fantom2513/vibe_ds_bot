import { useMemo } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { chartSeriesColors } from '../styles/chartPalette'

const formatHours = seconds => (Number(seconds || 0) / 3600).toFixed(1)

const formatDateShort = iso => {
  const [, month, day] = iso.split('-')
  return `${day}.${month}`
}

const tooltipFormatter = (value, name) => [`${formatHours(value)} ч`, name]

/**
 * Столбчатая диаграмма рабочих часов по дням, сгруппированная по участникам.
 * data — ответ GET /api/tracking/daily-work-hours: { members, days }.
 */
export default function DailyWorkHoursChart({ data }) {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'))
  const members = data?.members || []
  const days = data?.days || []

  const chartData = useMemo(
    () => days.map(day => ({ ...day, dateLabel: formatDateShort(day.date) })),
    [days],
  )

  if (members.length === 0 || days.length === 0) return null

  return (
    <Box sx={{ width: '100%', height: isCompact ? 240 : 320, overflow: 'hidden' }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatHours}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)',
              borderRadius: 8, fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-text-primary)' }}
            itemStyle={{ color: 'var(--color-text-primary)' }}
            formatter={tooltipFormatter}
          />
          {members.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-text-secondary)' }} />}
          {members.map((member, index) => (
            <Bar
              key={member.discord_id}
              dataKey={member.discord_id}
              name={member.username || member.discord_id}
              fill={chartSeriesColors[index % chartSeriesColors.length]}
              radius={[4, 4, 0, 0]}
              // Grouped bars otherwise mount on a staggered per-series
              // entrance animation, which briefly shows fewer distinct
              // series colors than the final render — this is dense
              // operational data, not a decorative visualization, so a
              // static mount keeps the chart deterministic and matches the
              // "no choreography for routine data" motion guidance.
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}
