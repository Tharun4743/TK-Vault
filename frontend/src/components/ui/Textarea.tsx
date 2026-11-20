import React from 'react';
import { cn } from '../../lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = ({ className, ...props }: TextareaProps) => (
  <textarea
    autoComplete="off"
    autoCorrect="off"
    spellCheck={false}
    className={cn(
      'w-full px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/10 focus:border-black dark:focus:border-white transition-all text-sm min-h-[100px] resize-y bg-white dark:bg-[#141418] text-zinc-900 dark:text-white placeholder:text-zinc-400',
      className
    )}
    {...props}
  />
);

export default Textarea;
