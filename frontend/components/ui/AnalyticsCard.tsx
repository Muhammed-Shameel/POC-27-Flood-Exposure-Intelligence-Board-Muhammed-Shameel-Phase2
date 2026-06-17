'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface AnalyticsCardProps {
  title: string
  children: React.ReactNode
  accent?: 'cyan' | 'indigo'
  className?: string
}

export default function AnalyticsCard({
  title,
  children,
  accent = 'cyan',
  className = '',
}: AnalyticsCardProps) {
  const accentColors = {
    cyan: 'border-accent-cyan/20 from-accent-cyan/5',
    indigo: 'border-accent-indigo/20 from-accent-indigo/5',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`
        rounded-lg border backdrop-blur-sm bg-card-bg
        bg-gradient-to-br ${accentColors[accent]} to-transparent
        overflow-hidden ${className}
      `}
      style={{
        borderColor: accent === 'cyan' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(129, 140, 248, 0.2)',
      }}
    >
      {/* Title bar */}
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className={`text-sm font-semibold ${
          accent === 'cyan' ? 'text-accent-cyan' : 'text-accent-indigo'
        } uppercase tracking-wider`}>
          {title}
        </h3>
      </div>

      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  )
}
