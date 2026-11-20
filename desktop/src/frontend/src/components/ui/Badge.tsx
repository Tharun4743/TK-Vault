import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary' | 'outline';
  className?: string;
}

export const Badge = ({ children, variant = 'neutral', className }: BadgeProps) => {
  const styles: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    danger: 'bg-red-50 text-red-700 border border-red-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    info: 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    neutral: 'bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
    primary: 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
    outline: 'bg-transparent text-zinc-700 border border-zinc-300 dark:border-zinc-700 dark:text-zinc-200',
  };

  return (
    <span className={cn('px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-tight inline-flex items-center gap-1.5', styles[variant] || styles.neutral, className)}>
      {children}
    </span>
  );
};

export default Badge;
