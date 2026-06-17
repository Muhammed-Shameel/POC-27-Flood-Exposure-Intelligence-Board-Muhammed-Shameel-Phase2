/*
Analytics Drawer Component
Hidden expandable panel with tabs for heavy chart rendering.
*/

'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp } from 'lucide-react'

interface AnalyticsDrawerProps {
  children?: React.ReactNode
}

type TabType = 'analysis' | 'forecast' | 'simulation' | 'insights'

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'analysis', label: 'Analysis', icon: '=' },
  { id: 'forecast', label: 'Forecast', icon: '~' },
  { id: 'simulation', label: 'Simulation', icon: '+' },
  { id: 'insights', label: 'AI Insights', icon: '*' },
]

export default function AnalyticsDrawer({ children }: AnalyticsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('analysis')

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-6 py-3 bg-card-bg border border-emerald-500/30 rounded-full hover:border-emerald-500/60 transition-all duration-300 flex items-center gap-2 group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-sm font-semibold text-emerald-400">ANALYTICS</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <ChevronUp size={16} className="text-emerald-400" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-0 left-0 right-0 z-30 max-h-[60vh] bg-dark-bg border-t border-emerald-500/20 backdrop-blur-lg rounded-t-2xl overflow-hidden"
          >
            <div className="flex gap-1 px-6 pt-6 pb-4 border-b border-emerald-500/10 bg-dark-bg/50">
              {tabs.map((tab) => (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'text-gray-400 hover:text-emerald-400 border border-transparent'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {tab.icon} {tab.label}
                </motion.button>
              ))}
            </div>

            <div className="overflow-y-auto max-h-[calc(60vh-80px)]">
              <div className="p-6 space-y-6">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="space-y-6"
                >
                  {children ?? (
                    <div className="p-4 bg-card-bg border border-emerald-500/20 rounded-lg text-sm text-gray-400">
                      Dynamic analytics are loaded from the active dashboard data stream.
                    </div>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
