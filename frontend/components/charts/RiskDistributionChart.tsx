'use client'

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import AnalyticsCard from '@/components/ui/AnalyticsCard'
import { formatDisplayNumber } from '@/lib/utils'

interface RiskDistributionChartProps {
  distribution: Record<string, number> | null
}

export default function RiskDistributionChart({
  distribution,
}: RiskDistributionChartProps) {
  const data = distribution
    ? [
        { name: 'LOW', value: distribution.LOW || 0, fill: '#38BDF8' },
        { name: 'MODERATE', value: distribution.MODERATE || 0, fill: '#FBBF24' },
        { name: 'HIGH', value: distribution.HIGH || 0, fill: '#F97316' },
        { name: 'CRITICAL', value: distribution.CRITICAL || 0, fill: '#EF4444' },
      ]
    : []

  return (
    <AnalyticsCard title="Risk Level Distribution" accent="indigo">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818CF8" stopOpacity={1} />
              <stop offset="100%" stopColor="#818CF8" stopOpacity={0.6} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#333944" />
          <XAxis dataKey="name" stroke="#f8fafc" style={{ fontSize: '12px' }} />
          <YAxis stroke="#f8fafc" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f1115',
              border: '1px solid #333944',
              borderRadius: '8px',
              color: '#f8fafc'
            }}
            formatter={(value) => [`${formatDisplayNumber(Number(value), 0)} zones`, 'Count']}
            cursor={{ fill: 'rgba(129, 140, 248, 0.1)' }}
          />
          <Bar dataKey="value" isAnimationActive>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </AnalyticsCard>
  )
}
