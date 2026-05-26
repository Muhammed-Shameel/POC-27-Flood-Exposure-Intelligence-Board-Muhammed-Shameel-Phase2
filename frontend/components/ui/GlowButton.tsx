'use client'

import React from 'react'
import { motion } from 'framer-motion'

interface GlowButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  disabled?: boolean
}

export default function GlowButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
}: GlowButtonProps) {
  const baseStyles = 'relative font-semibold tracking-wide uppercase transition-all duration-300'

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  }

  const variantStyles = {
    primary: `
      bg-gradient-to-r from-accent-cyan to-accent-cyan/80
      text-dark-bg hover:shadow-[0_0_20px_rgba(56,189,248,0.5)]
      active:scale-95
    `,
    secondary: `
      border border-accent-indigo/60 text-accent-indigo
      hover:border-accent-indigo hover:bg-accent-indigo/10
      hover:shadow-[0_0_15px_rgba(129,140,248,0.3)]
    `,
    ghost: `
      text-accent-cyan hover:bg-accent-cyan/10
      hover:border-accent-cyan/40 border border-accent-cyan/20
    `,
  }

  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      onClick={onClick}
      disabled={disabled}
      className={`
        ${baseStyles}
        ${sizeStyles[size]}
        ${variantStyles[variant]}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        rounded-lg
        ${className}
      `}
    >
      {children}
    </motion.button>
  )
}
