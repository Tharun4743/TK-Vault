import React from 'react';
import { cn } from '../../lib/utils';

export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const PageLayout = ({ children, className = '' }: PageLayoutProps) => (
  <div className={cn('p-4 md:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full', className)}>
    {children}
  </div>
);

export default PageLayout;
