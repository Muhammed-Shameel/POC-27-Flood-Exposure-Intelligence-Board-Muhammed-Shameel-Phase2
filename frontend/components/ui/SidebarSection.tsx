'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface SidebarSectionProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultExpanded?: boolean
  onToggle?: (expanded: boolean) => void
}

export default function SidebarSection({
  title,
  icon,
  children,
  defaultExpanded = true,
  onToggle,
}: SidebarSectionProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded)

  const handleToggle = () => {
    const newState = !isExpanded
    setIsExpanded(newState)
    onToggle?.(newState)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border/50 bg-card-bg bg-gradient-to-b from-card-bg/80 to-transparent backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-border/30"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-accent-cyan">{icon}</span>}
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            {title}
          </h3>
        </div>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-accent-cyan/60"
        >
          ▼
        </motion.span>
      </button>

      {/* Content */}
      <motion.div
        initial={false}
        animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        <div className="px-4 py-3 space-y-3">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}
