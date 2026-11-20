import React from 'react';
import { cn } from '../../lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, ...props }: InputProps) => (
  <input
    autoComplete="off"
    autoCorrect="off"
    spellCheck={false}
    className={cn(
      'w-full h-11 px-4 rounded-lg border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-sm bg-white dark:bg-[#141418] text-zinc-900 dark:text-white placeholder:text-zinc-400',
      className
    )}
    {...props}
  />
);

export default Input;
