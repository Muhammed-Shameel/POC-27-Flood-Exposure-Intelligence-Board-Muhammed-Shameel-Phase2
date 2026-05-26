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

const accentColorMap = {
  cyan: '#38BDF8',
  indigo: '#818CF8',
  red: '#EF4444',
  yellow: '#FBBF24',
}

const accentBgMap = {
  cyan: 'border-accent-cyan/30 hover:border-accent-cyan/60',
  indigo: 'border-accent-indigo/30 hover:border-accent-indigo/60',
  red: 'border-red-500/30 hover:border-red-500/60',
  yellow: 'border-yellow-500/30 hover:border-yellow-500/60',
}

const accentTextMap = {
  cyan: 'text-accent-cyan',
  indigo: 'text-accent-indigo',
  red: 'text-red-400',
  yellow: 'text-yellow-400',
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
      whileHover={{ scale: 1.02, y: -1, borderColor: accentColorMap[accentColor] }}
      className={`
        relative overflow-hidden rounded-lg border transition-all duration-300
        ${accentBgMap[accentColor]}
        ${isCompact ? 'p-3' : 'p-4'}
        bg-gradient-to-br from-card-bg via-card-bg to-dark-bg
        backdrop-blur-md
      `}
      style={{
        boxShadow: `inset 0 0 20px ${accentColorMap[accentColor]}15`,
      }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Glow background */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accentColorMap[accentColor]}20, transparent)`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header with icon and label */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <p className={`text-xs font-semibold text-gray-400 uppercase tracking-wider ${isCompact ? 'mb-1' : 'mb-2'}`}>
              {label}
            </p>
          </div>
          {icon && <div className="text-base opacity-60">{icon}</div>}
        </div>

        {/* Value */}
        <div className={isCompact ? 'flex items-end gap-1' : 'mb-2'}>
          <span className={`${accentTextMap[accentColor]} font-bold ${isCompact ? 'text-lg' : 'text-2xl'}`}>
            {value}
          </span>
          {unit && (
            <span className={`text-gray-500 ${isCompact ? 'text-xs' : 'text-sm'}`}>
              {unit}
            </span>
          )}
        </div>

        {/* Trend indicator */}
        {trend && !isCompact && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            <span className={trend.direction === 'up' ? 'text-red-400' : 'text-green-400'}>
              {trend.direction === 'up' ? '↑' : '↓'}
            </span>
            <span className={trend.direction === 'up' ? 'text-red-400' : 'text-green-400'}>
              {Math.abs(trend.value)}%
            </span>
            <span className="text-gray-500">vs last hour</span>
          </div>
        )}
      </div>

      {/* Top accent line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: `linear-gradient(to right, ${accentColorMap[accentColor]}00, ${accentColorMap[accentColor]}80, ${accentColorMap[accentColor]}00)`,
        }}
      />
    </motion.div>
  )
}
