import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Home, Library, User, BarChart2, ShieldAlert, FileText, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';
import ThemeToggle from '../components/ThemeToggle';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function MainLayout() {
  const { user } = useAuth();
  const location = useLocation();

  // Track SPA route navigation events in Google Analytics (gtag.js)
  useEffect(() => {
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('config', 'G-52M2R0WYH0', {
        page_path: location.pathname + location.search,
        page_title: document.title || 'Kortex'
      });
    }
  }, [location.pathname, location.search]);

  const isChatPage = location.pathname === '/chat';
  const isCoursePage = location.pathname.startsWith('/course/');
  const isBillingPage = location.pathname === '/billing';
  const isRepPage = location.pathname.startsWith('/rep');
  
  const fullScreenRoutes = ['/profile', '/edit-profile', '/academic-profile', '/notifications', '/rep', '/admin'];
  const isFullScreenPage = fullScreenRoutes.includes(location.pathname) || isChatPage || isCoursePage || isBillingPage;
  
  // Hide bottom tab bar on Billing/Premium, AI Chat, and Representative Portal pages
  const hideTabBar = isBillingPage || isChatPage || isRepPage;
  const navigate = useNavigate();

  // Define active tabs sections dynamically to support active states for nested routes
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/profile' || path === '/edit-profile' || path === '/academic-profile' || path === '/notifications' || path === '/admin') {
      return 'profile';
    }
    if (path === '/library' || path.startsWith('/course/')) {
      return 'library';
    }
    if (path === '/chat') {
      return 'chat';
    }
    // Default or home-connected pages (including analytics & billing)
    if (path === '/' || path === '/analytics' || path === '/billing') {
      return 'home';
    }
    return 'home';
  };
  
  const activeTab = getActiveTab();

  return (
    <div className={cn(
      "min-h-[100dvh] flex flex-col",
      "bg-background",
      !hideTabBar && "pb-20",
      (isChatPage || isCoursePage) && "h-[100dvh] overflow-hidden !pb-0" // override to prevent main page scroll
    )}>
      <main className={cn(
        "flex-1 flex flex-col w-full min-h-0",
        !isFullScreenPage ? "p-4 sm:p-6 xl:p-8" : "p-0",
        !isFullScreenPage && "max-w-4xl mx-auto",
        (isChatPage || isCoursePage) && "h-full overflow-hidden !max-w-none"
      )}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            className={cn((isChatPage || isCoursePage) && "flex-grow flex flex-col min-h-0 w-full h-full overflow-hidden")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }} // faster transition
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {!hideTabBar && (
        <div className="fixed bottom-6 left-0 right-0 z-[100] px-4 pointer-events-none flex justify-center">
          <nav className="w-[90%] max-w-md h-16 bg-[#18181b] dark:bg-[#1E232E] rounded-full flex items-center justify-between px-2 sm:px-4 shadow-[0_12px_40px_rgba(0,0,0,0.25)] border border-white/10 dark:border-white/15 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] pointer-events-auto transition-all backdrop-blur-md">
            {/* Student Navigation */}
            <>
              <NavLink to="/" className={cn(
                "h-12 flex items-center gap-2 px-4 rounded-full transition-all duration-300",
                activeTab === 'home' ? "bg-[#3f3f46] dark:bg-[#343C4B] text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}>
                <>
                  <Home size={20} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                  {activeTab === 'home' && (
                    <motion.span 
                      layoutId="nav-label-1"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                    >
                      Home
                    </motion.span>
                  )}
                </>
              </NavLink>

              <NavLink to="/library" className={cn(
                "h-12 flex items-center gap-2 px-4 rounded-full transition-all duration-300",
                activeTab === 'library' ? "bg-[#3f3f46] dark:bg-[#343C4B] text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}>
                <>
                  <Library size={20} strokeWidth={activeTab === 'library' ? 2.5 : 2} />
                  {activeTab === 'library' && (
                    <motion.span 
                      layoutId="nav-label-1"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                    >
                      Library
                    </motion.span>
                  )}
                </>
              </NavLink>

              <NavLink to="/chat" className={cn(
                "h-12 flex items-center gap-2 px-4 rounded-full transition-all duration-300",
                activeTab === 'chat' ? "bg-[#3f3f46] dark:bg-[#343C4B] text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}>
                <>
                  <MessageSquare size={20} strokeWidth={activeTab === 'chat' ? 2.5 : 2} />
                  {activeTab === 'chat' && (
                    <motion.span 
                      layoutId="nav-label-1"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                    >
                      Chat
                    </motion.span>
                  )}
                </>
              </NavLink>
              
              <NavLink to="/profile" className={cn(
                "h-12 flex items-center gap-2 px-4 rounded-full transition-all duration-300",
                activeTab === 'profile' ? "bg-[#3f3f46] dark:bg-[#343C4B] text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200 dark:text-zinc-400 dark:hover:text-zinc-200"
              )}>
                <>
                  <User size={20} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
                  {activeTab === 'profile' && (
                    <motion.span 
                      layoutId="nav-label-1"
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap"
                    >
                      Profile
                    </motion.span>
                  )}
                </>
              </NavLink>
            </>
          </nav>
        </div>
      )}
    </div>
  );
}
