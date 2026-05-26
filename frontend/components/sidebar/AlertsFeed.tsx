'use client'

import React from 'react'
import { Alert } from '@/types'
import { motion } from 'framer-motion'
import { formatDate } from '@/lib/utils'

interface AlertsFeedProps {
  alerts: Alert[]
}

export default function AlertsFeed({ alerts }: AlertsFeedProps) {
  return (
    <motion.div
      className="glow-box p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <h3 className="text-sm font-bold text-accent-yellow uppercase mb-3 border-b border-border pb-2">
        🚨 Active Alerts
      </h3>

      {alerts.length === 0 ? (
        <p className="text-xs text-gray-400">No active alerts</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              className="text-xs p-2 rounded border-l-4"
              style={{
                borderLeftColor:
                  alert.alert_type === 'critical'
                    ? '#EF4444'
                    : alert.alert_type === 'danger'
                      ? '#F97316'
                      : '#FBBF24',
                backgroundColor:
                  alert.alert_type === 'critical'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : alert.alert_type === 'danger'
                      ? 'rgba(249, 115, 22, 0.1)'
                      : 'rgba(251, 191, 36, 0.1)',
              }}
              whileHover={{ scale: 1.02 }}
            >
              <p className="font-semibold text-white mb-1">{alert.title}</p>
              <p className="text-gray-300 mb-1">{alert.message}</p>
              <div className="flex justify-between text-gray-400 text-xs">
                <span>{alert.zone_id}</span>
                <span>{formatDate(alert.timestamp)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
