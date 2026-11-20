import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export type ThemeMode = 'light' | 'dark';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('app_theme') as ThemeMode | null;
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark';
  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  try {
    localStorage.setItem('app_theme', theme);
  } catch {}
}

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    const current = getInitialTheme();
    setTheme(current);
    applyTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer shadow-2xs ${className}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-zinc-600" />}
    </button>
  );
};

export default ThemeToggle;
