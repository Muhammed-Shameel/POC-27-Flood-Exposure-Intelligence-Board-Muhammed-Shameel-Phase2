'use client'

import React from 'react'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import AnalyticsCard from '@/components/ui/AnalyticsCard'
import { formatMetric } from '@/lib/utils'

interface RainfallTrendChartProps {
  data: Array<{ time: string; rainfall: number }>
}

export default function RainfallTrendChart({
  data,
}: RainfallTrendChartProps) {
  const chartData = data ?? []

  return (
    <AnalyticsCard title="Rainfall Trend" accent="cyan">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="rainfallGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#38BDF8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333944" />
          <XAxis dataKey="time" stroke="#f8fafc" style={{ fontSize: '12px' }} />
          <YAxis stroke="#f8fafc" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f1115',
              border: '1px solid #333944',
              borderRadius: '8px',
              color: '#f8fafc'
            }}
            formatter={(value) => [formatMetric(Number(value), ' mm'), 'Rainfall']}
            cursor={{ stroke: '#38BDF8', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="rainfall"
            stroke="#38BDF8"
            fill="url(#rainfallGradient)"
            strokeWidth={2}
            dot={{ fill: '#38BDF8', r: 4 }}
            activeDot={{ r: 6, fill: '#38BDF8' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </AnalyticsCard>
  )
}
