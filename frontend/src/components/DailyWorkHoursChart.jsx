import { useMemo } from 'react'
import { Box } from '@mui/material'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

// Категориальная палитра (dark-режим), фиксированный порядок — цвет закреплён
// за участником по индексу, не за рангом, чтобы не перекрашивались остальные
// при изменении списка. См. skill dataviz/references/palette.md.
const SERIES_COLORS = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767',
]

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
  const members = data?.members || []
  const days = data?.days || []

  const chartData = useMemo(
    () => days.map(day => ({ ...day, dateLabel: formatDateShort(day.date) })),
    [days],
  )

  if (members.length === 0 || days.length === 0) return null

  return (
    <Box sx={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.15)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatHours}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: '#1a1a19', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, fontSize: 12,
            }}
            labelStyle={{ color: '#fff' }}
            formatter={tooltipFormatter}
          />
          {members.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {members.map((member, index) => (
            <Bar
              key={member.discord_id}
              dataKey={member.discord_id}
              name={member.username || member.discord_id}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}
