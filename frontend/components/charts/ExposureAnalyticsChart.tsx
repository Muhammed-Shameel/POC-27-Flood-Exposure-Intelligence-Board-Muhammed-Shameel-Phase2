'use client'

import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import AnalyticsCard from '@/components/ui/AnalyticsCard'
import { formatMetric } from '@/lib/utils'

interface ExposureAnalyticsChartProps {
  data: Array<{ name: string; value: number }>
}

export default function ExposureAnalyticsChart({
  data,
}: ExposureAnalyticsChartProps) {
  const COLORS = ['#38bdf8', '#64748b', '#fb923c', '#f87171']

  const chartData = data ?? []

  return (
    <AnalyticsCard title="Exposure Distribution" accent="cyan">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            fill="#333944"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e222a',
              border: '1px solid #333944',
              borderRadius: '8px',
              color: '#f8fafc',
            }}
            formatter={(value) => [formatMetric(Number(value), '%'), 'Exposure']}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: COLORS[idx % COLORS.length] }}
            />
            <span className="text-text-main/70">{item.name}: {formatMetric(item.value, '%')}</span>
          </div>
        ))}
      </div>
    </AnalyticsCard>
  )
}
