'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { formatDisplayNumber } from '@/lib/utils'
import { useScenarioSimulation } from '@/hooks/useFloodData'

interface ControlPanelProps {
  rainfallMultiplier: number
  onRainfallMultiplierChange: (value: number) => void
}

export default function ControlPanel({
  rainfallMultiplier,
  onRainfallMultiplierChange,
}: ControlPanelProps) {
  const { runScenario, loading } = useScenarioSimulation()

  const handleScenario = async (multiplier: number) => {
    onRainfallMultiplierChange(multiplier)
    await runScenario(multiplier)
  }

  return (
    <motion.div
      className="glow-box p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.15 }}
    >
      <h3 className="text-sm font-bold text-accent-indigo uppercase mb-3 border-b border-border pb-2">
        Scenario Controls
      </h3>

      <div className="space-y-3">
        {/* Rainfall Simulation */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-gray-400">Rainfall Multiplier</label>
            <span className="text-sm font-bold text-accent-cyan">{formatDisplayNumber(rainfallMultiplier, 1)}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={rainfallMultiplier}
            onChange={(e) => onRainfallMultiplierChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, #38BDF8 0%, #38BDF8 ${((rainfallMultiplier - 0.5) / 2.5) * 100}%, #1F2937 ${((rainfallMultiplier - 0.5) / 2.5) * 100}%, #1F2937 100%)`,
            }}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low (0.5x)</span>
            <span>Extreme (3.0x)</span>
          </div>
        </div>

        {/* Preset Scenarios */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Preset Scenarios</p>
          <div className="grid grid-cols-2 gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleScenario(0.7)}
              disabled={loading}
              className="text-xs px-2 py-2 bg-blue-500/20 border border-blue-500/50 text-blue-300 rounded hover:bg-blue-500/30 disabled:opacity-50"
            >
              Low (0.7x)
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleScenario(1.5)}
              disabled={loading}
              className="text-xs px-2 py-2 bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 rounded hover:bg-yellow-500/30 disabled:opacity-50"
            >
              Moderate (1.5x)
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleScenario(2.0)}
              disabled={loading}
              className="text-xs px-2 py-2 bg-orange-500/20 border border-orange-500/50 text-orange-300 rounded hover:bg-orange-500/30 disabled:opacity-50 col-span-2"
            >
              Extreme (2.0x)
            </motion.button>
          </div>
        </div>

        {/* Region Selector */}
        <div>
          <label className="text-xs text-gray-400 block mb-2">Focus Region</label>
          <select className="w-full bg-border text-white text-xs p-2 rounded border border-gray-600">
            <option>All Regions</option>
            <option>Central District</option>
            <option>North Zone</option>
            <option>South Sector</option>
            <option>East Riverside</option>
            <option>West Valley</option>
          </select>
        </div>
      </div>
    </motion.div>
  )
}
