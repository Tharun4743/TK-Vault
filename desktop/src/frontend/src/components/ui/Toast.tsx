import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface ToastContainerProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer = ({ toasts, removeToast }: ToastContainerProps) => (
  <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
    <AnimatePresence>
      {toasts.map(toast => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.9 }}
          className={cn(
            'p-4 rounded-xl shadow-lg border flex items-start gap-3 w-80 pointer-events-auto backdrop-blur-md',
            toast.type === 'success' ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200' :
            toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-200' :
            toast.type === 'warning' ? 'bg-amber-50/95 border-amber-200 text-amber-800 dark:bg-amber-950/90 dark:border-amber-800 dark:text-amber-200' :
            'bg-blue-50/95 border-blue-200 text-blue-800 dark:bg-blue-950/90 dark:border-blue-800 dark:text-blue-200'
          )}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> :
             toast.type === 'error' ? <XCircle size={18} className="text-red-500" /> :
             toast.type === 'warning' ? <AlertTriangle size={18} className="text-amber-500" /> :
             <Info size={18} className="text-blue-500" />}
          </div>
          <p className="text-sm font-medium flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-zinc-400 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

export default ToastContainer;
