import React from 'react';
import { cn } from '../../lib/utils';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'outline';
  children?: React.ReactNode;
};

export const Button = ({ className, variant = 'primary', ...props }: ButtonProps) => {
  const variants = {
    primary: 'bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 focus:ring-black/10',
    secondary: 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700 focus:ring-zinc-200/50',
    danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500/20',
    ghost: 'hover:bg-zinc-100 text-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 focus:ring-zinc-200/50',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-600/20',
    outline: 'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-zinc-900 dark:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800'
  };

  return (
    <button
      className={cn(
        'h-11 px-4 rounded-lg font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 inline-flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-1 shrink-0 cursor-pointer',
        variants[variant] || variants.primary,
        className
      )}
      {...props}
    />
  );
};

export default Button;
