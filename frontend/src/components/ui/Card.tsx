import React from 'react';
import { cn } from '../../lib/utils';

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode;
};

export const Card = ({ children, className, ...props }: CardProps) => (
  <div
    className={cn('bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 md:p-6 shadow-sm', className)}
    {...props}
  >
    {children}
  </div>
);

export const ContentCard = ({ children, className, ...props }: CardProps) => (
  <div
    className={cn('bg-white dark:bg-[#141418] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 shadow-sm w-full', className)}
    {...props}
  >
    {children}
  </div>
);

export default Card;
