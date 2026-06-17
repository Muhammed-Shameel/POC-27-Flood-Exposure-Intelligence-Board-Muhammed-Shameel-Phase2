'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface KPICardProps {
  label: string
  value: string | number
  unit?: string
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  icon?: React.ReactNode
  accentColor?: 'cyan' | 'indigo' | 'red' | 'yellow'
  size?: 'compact' | 'normal'
}

const accentBgMap = {
  cyan: 'border-accent-cyan/30 hover:border-accent-cyan/60',
  indigo: 'border-accent-indigo/30 hover:border-accent-indigo/60',
  red: 'border-accent-red/30 hover:border-accent-red/60',
  yellow: 'border-accent-yellow/30 hover:border-accent-yellow/60',
}

const accentTextMap = {
  cyan: 'text-accent-cyan',
  indigo: 'text-accent-indigo',
  red: 'text-accent-red',
  yellow: 'text-accent-yellow',
}

export default function KPICard({
  label,
  value,
  unit,
  trend,
  icon,
  accentColor = 'cyan',
  size = 'normal',
}: KPICardProps) {
  const isCompact = size === 'compact'

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -1 }}
      className={`
        relative overflow-hidden rounded-lg border bg-card-bg
        ${accentBgMap[accentColor]}
        ${isCompact ? 'p-3' : 'p-4'}
        transition-all duration-300
      `}
      whileTap={{ scale: 0.99 }}
    >
      {/* Content */}
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs font-semibold text-text-main/70 uppercase tracking-wider">
            {label}
          </p>
          {icon && <div className="text-base opacity-70 text-text-main">{icon}</div>}
        </div>

        <div className={isCompact ? 'flex items-end gap-1' : 'mb-2'}>
          <span className={`${accentTextMap[accentColor]} font-bold ${isCompact ? 'text-lg' : 'text-2xl'}`}>
            {value}
          </span>
          {unit && (
            <span className={`text-text-main/50 ${isCompact ? 'text-xs' : 'text-sm'}`}>
              {unit}
            </span>
          )}
        </div>

        {trend && !isCompact && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            <span className={trend.direction === 'up' ? 'text-accent-red' : 'text-accent-green'}>
              {trend.direction === 'up' ? '↑' : '↓'}
            </span>
            <span className={trend.direction === 'up' ? 'text-accent-red' : 'text-accent-green'}>
              {Math.abs(trend.value)}%
            </span>
            <span className="text-text-main/50">vs last hour</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
