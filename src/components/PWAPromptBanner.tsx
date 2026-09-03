import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, X } from 'lucide-react';
import { usePWA } from '../hooks/usePWA';
import { toast } from 'react-hot-toast';

export default function PWAPromptBanner() {
  const { isInstalled, installable, isIPhone, triggerInstall } = usePWA();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // If already installed, never show
    if (isInstalled) {
      setVisible(false);
      return;
    }
    
    // If iOS screen, don't show at all
    if (isIPhone) {
      setVisible(false);
      return;
    }

    // Occasional reminder check: check if dismissed within past 2 days
    const dismissedTimestamp = localStorage.getItem('pwa_reminder_dismissed_at');
    const now = Date.now();
    
    if (dismissedTimestamp) {
      const elapsed = now - parseInt(dismissedTimestamp, 10);
      const limit = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
      
      if (elapsed < limit) {
        setVisible(false);
        return;
      }
    }

    // Delay showing the banner for 3 seconds on load to make it feel non-intrusive
    const timer = setTimeout(() => {
      setVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isInstalled, isIPhone]);

  const handleDismiss = () => {
    localStorage.setItem('pwa_reminder_dismissed_at', Date.now().toString());
    setVisible(false);
  };

  const handleInstallClick = async () => {
    if (installable) {
      const success = await triggerInstall();
      if (success) {
        toast.success("Welcome aboard! Kortex AI is now installed.");
        setVisible(false);
      }
    } else {
      // Try to let them trigger via browser options elegantly
      toast.error("Install prompt is initializing or this device has PWA disabled. Try browser's ⋮ -> 'Install App'.");
    }
  };

  if (!visible || isIPhone) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="fixed top-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[999] bg-white dark:bg-[#121218] border border-zinc-200 dark:border-zinc-800 rounded-[28px] p-4 flex gap-4 shadow-2xl backdrop-blur-md text-text"
        >
          {/* Left Brand Icon */}
          <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-2xl flex items-center justify-center shrink-0">
            <Smartphone size={20} />
          </div>

          {/* Middle Message */}
          <div className="flex-1 min-w-0 pr-2">
            <h5 className="text-[13px] font-black tracking-tight text-neutral-900 dark:text-white">
              Learn Standalone
            </h5>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal mt-0.5">
              Install Kortex AI for faster load speeds, native screen views, and complete offline guides.
            </p>
            
            <div className="flex gap-3 mt-2.5">
              <button
                onClick={handleInstallClick}
                className="px-4 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:bg-opacity-95 active:scale-95 transition-all cursor-pointer"
              >
                Install Now
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 bg-neutral-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded-xl hover:bg-neutral-200 dark:hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          </div>

          {/* Right Close Button */}
          <button
            onClick={handleDismiss}
            className="p-1 text-muted hover:text-text rounded-full h-fit hover:bg-neutral-100 dark:hover:bg-white/5 transition-all cursor-pointer"
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
