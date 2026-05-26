/*
Frontend utility functions
*/

import { RiskLevel } from '@/types'
import clsx, { type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function getRiskColor(risk: RiskLevel): string {
  const colors = {
    LOW: '#38BDF8',      // cyan
    MODERATE: '#FBBF24', // yellow
    HIGH: '#F97316',     // orange
    CRITICAL: '#EF4444', // red
  }
  return colors[risk]
}

export function getRiskBgColor(risk: RiskLevel): string {
  const colors = {
    LOW: 'bg-blue-500/10 border-blue-500/20',
    MODERATE: 'bg-yellow-500/10 border-yellow-500/20',
    HIGH: 'bg-orange-500/10 border-orange-500/20',
    CRITICAL: 'bg-red-500/10 border-red-500/20',
  }
  return colors[risk]
}

export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.min(decimals, 2),
    minimumFractionDigits: 0,
  }).format(num)
}

export function formatDisplayNumber(
  value: number | string | null | undefined,
  maxDecimals: number = 2,
): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return '--'

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: Math.min(maxDecimals, 2),
    minimumFractionDigits: 0,
  }).format(num)
}

export function formatMetric(
  value: number | string | null | undefined,
  unit: string = '',
  maxDecimals: number = 2,
): string {
  const formatted = formatDisplayNumber(value, maxDecimals)
  return formatted === '--' ? formatted : `${formatted}${unit}`
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function calculateExposurePercentage(affected: number, total: number): number {
  if (total === 0) return 0
  return Math.round((affected / total) * 100)
}

export function getAlertIcon(riskLevel: RiskLevel) {
  const icons = {
    LOW: '⚠️',
    MODERATE: '⚠️',
    HIGH: '🚨',
    CRITICAL: '🚨',
  }
  return icons[riskLevel]
}

export function riskScoreToProbability(score: number): string {
  if (score >= 80) return 'Almost Certain'
  if (score >= 60) return 'Likely'
  if (score >= 40) return 'Possible'
  return 'Unlikely'
}

export function estimateEvacuationTime(population: number, difficulty: number): string {
  // Rough estimation: 1000 people per hour with difficulty modifier
  const baseRate = 1000
  const adjustedRate = baseRate / (1 + difficulty)
  const hours = Math.ceil(population / adjustedRate)
  
  if (hours < 1) return '<1 hour'
  if (hours === 1) return '~1 hour'
  return `~${hours} hours`
}
