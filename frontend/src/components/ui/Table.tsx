import React from 'react';
import { cn } from '../../lib/utils';

export const Table = ({ children, className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <div className="w-full overflow-x-auto border border-zinc-200 dark:border-zinc-800/80 rounded-2xl bg-white dark:bg-[#141418] shadow-sm">
    <table className={cn('w-full text-left border-collapse', className)} {...props}>
      {children}
    </table>
  </div>
);

export const THead = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead className={cn('bg-zinc-50 dark:bg-[#101014] border-b border-zinc-200 dark:border-zinc-800', className)} {...props}>
    {children}
  </thead>
);

export const TBody = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody className={cn('divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-[#141418]', className)} {...props}>
    {children}
  </tbody>
);

export const TR = ({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={cn('hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors h-14 text-sm', className)} {...props}>
    {children}
  </tr>
);

export const TH = ({ children, className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={cn('px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider', className)} {...props}>
    {children}
  </th>
);

export const TD = ({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-6 py-4 text-zinc-600 dark:text-zinc-300', className)} {...props}>
    {children}
  </td>
);
