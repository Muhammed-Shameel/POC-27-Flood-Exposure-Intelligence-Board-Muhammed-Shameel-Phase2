'use client'

import React from 'react'
import { RainfallData } from '@/types'

interface RainfallOverlayProps {
  data: RainfallData[]
  multiplier: number
}

export default function RainfallOverlay({ data, multiplier }: RainfallOverlayProps) {
  // Rainfall visualization layer
  // Could display using heatmap or custom canvas rendering
  return null
}
