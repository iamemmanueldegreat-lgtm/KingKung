import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className={`
        w-11 h-11 rounded-[14px] flex items-center justify-center border transition-colors
        ${isDark ? 'border-white/20 text-white/80 hover:bg-white/5 hover:text-white' : 'border-black/20 text-black/80 hover:bg-black/5 hover:text-black'}
      `}
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? 'dark' : 'light'}
          initial={{ opacity: 0, scale: 0.8, rotate: -45 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotate: 45 }}
          transition={{ duration: 0.2 }}
        >
          {isDark ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
