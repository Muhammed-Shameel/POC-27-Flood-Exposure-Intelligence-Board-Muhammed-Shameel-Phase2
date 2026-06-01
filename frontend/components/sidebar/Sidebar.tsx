'use client'

import React, { useState } from 'react'
import { FloodZone, Alert } from '@/types'
import { motion } from 'framer-motion'
import RiskScoreCard from './RiskScoreCard'
import EmergencyImpactPanel from './EmergencyImpactPanel'
import AlertsFeed from './AlertsFeed'
import ControlPanel from './ControlPanel'
import { formatDisplayNumber } from '@/lib/utils'

interface SidebarProps {
  selectedZone: FloodZone | null
  globalRiskIndex: number | null
  alerts: Alert[]
  criticalAlerts: Alert[]
  riskDistribution: Record<string, number> | null
  rainfallMultiplier: number
  onRainfallMultiplierChange: (value: number) => void
  impacts: any
}

export default function Sidebar({
  selectedZone,
  globalRiskIndex,
  alerts,
  criticalAlerts,
  riskDistribution,
  rainfallMultiplier,
  onRainfallMultiplierChange,
  impacts,
}: SidebarProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('risks')

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex flex-col gap-4 p-4 overflow-y-auto"
    >
      {/* SECTION A: Platform Header & Global Risk */}
      <motion.div
        className="glow-box p-4 border-l-4 border-accent-cyan"
        whileHover={{ boxShadow: '0 0 20px rgba(56, 189, 248, 0.2)' }}
      >
        <h1 className="text-2xl font-bold text-accent-cyan mb-1">
          FLOOD INTELLIGENCE
        </h1>
        <p className="text-xs text-gray-400 mb-3">REAL-TIME COMMAND CENTER</p>

        <div className="flex items-end gap-2">
          <div>
            <p className="text-xs text-gray-400">GLOBAL RISK INDEX</p>
            <p className="text-3xl font-bold text-accent-cyan">
              {globalRiskIndex !== null ? formatDisplayNumber(globalRiskIndex, 1) : '--'}
            </p>
          </div>
          {globalRiskIndex !== null && (
            <div className="flex-1">
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-cyan to-accent-indigo transition-all"
                  style={{ width: `${Math.min(globalRiskIndex, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Active Alerts Badge */}
        <div className="mt-3 pt-3 border-t border-border">
          <div className="flex justify-between text-sm">
            <span className="text-yellow-400">⚠️ Active Alerts: {alerts.length}</span>
            <span className="text-red-400">🚨 Critical: {criticalAlerts.length}</span>
          </div>
        </div>
      </motion.div>

      {/* SECTION B: Why This Matters */}
      <motion.div
        className="glow-box p-3"
        whileHover={{ scale: 1.02 }}
      >
        <p className="text-xs font-semibold text-accent-indigo uppercase tracking-wide mb-2">
          Why This Matters
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">
          Flood events threaten infrastructure, displace populations, and cause cascading economic damage. Real-time intelligence enables coordinated emergency response and protects critical assets.
        </p>
      </motion.div>

      {/* SECTION C: Emergency Impact Panel */}
      <EmergencyImpactPanel selectedZone={selectedZone} />

      {/* SECTION D: Control Panel */}
      <ControlPanel
        rainfallMultiplier={rainfallMultiplier}
        onRainfallMultiplierChange={onRainfallMultiplierChange}
      />

      {/* SECTION E: Alerts Feed */}
      <AlertsFeed alerts={alerts.slice(0, 5)} />
    </motion.div>
  )
}
