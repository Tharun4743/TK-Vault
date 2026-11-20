import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface FloatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export const FloatingModal: React.FC<FloatingModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  maxWidth = 'lg',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            onClick={e => e.stopPropagation()}
            className={cn(
              'relative w-full bg-white dark:bg-[#141418] rounded-2xl md:rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-10 max-h-[90vh] flex flex-col',
              maxWidthMap[maxWidth]
            )}
          >
            {/* Header */}
            {(title || icon) && (
              <div className="flex items-start justify-between p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-3">
                  {icon && (
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">{title}</h3>
                    {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  title="Close Modal"
                >
                  <X size={18} />
                </button>
              </div>
            )}

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">{children}</div>

            {/* Footer */}
            {footer && (
              <div className="p-4 px-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#101014] rounded-b-2xl md:rounded-b-3xl flex justify-end gap-2.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default FloatingModal;
