import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, Bell, Sparkles, Activity } from 'lucide-react';

interface NotificationItem {
  id: string;
  sender: string;
  text: string;
  time: string;
  group: 'TODAY' | 'YESTERDAY';
  avatar: string;
  avatarBg: string;
  isUnread: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'welcome_kortex',
    sender: 'Kortex AI',
    text: 'Welcome to Kortex AI! Your smart assistant for studying, exams, summaries, and courses is at your fingertips.',
    time: '09.15',
    group: 'TODAY',
    avatar: 'K',
    avatarBg: 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800',
    isUnread: true,
  },
];

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<NotificationItem[]>([]);

  // Simple persistence with localStorage & clean up old mock elements
  useEffect(() => {
    const storageKey = `kortex_notifications_${user?.id || 'guest'}`;
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as NotificationItem[];
        const hasDummyData = parsed.some(item => item.id !== 'welcome_kortex');
        const hasOldBg = parsed.some(item => item.id === 'welcome_kortex' && !item.avatarBg.includes('bg-white'));
        if (hasDummyData || hasOldBg) {
          setItems(DEFAULT_NOTIFICATIONS);
          localStorage.setItem(storageKey, JSON.stringify(DEFAULT_NOTIFICATIONS));
        } else {
          setItems(parsed);
        }
      } catch (e) {
        setItems(DEFAULT_NOTIFICATIONS);
      }
    } else {
      setItems(DEFAULT_NOTIFICATIONS);
    }
  }, [user?.id]);

  const saveToStorage = (updatedItems: NotificationItem[]) => {
    const storageKey = `kortex_notifications_${user?.id || 'guest'}`;
    localStorage.setItem(storageKey, JSON.stringify(updatedItems));
  };

  const handleToggleRead = (id: string) => {
    const updated = items.map((item) =>
      item.id === id ? { ...item, isUnread: !item.isUnread } : item
    );
    setItems(updated);
    saveToStorage(updated);
  };

  const handleMarkAllAsRead = () => {
    const updated = items.map((item) => ({ ...item, isUnread: false }));
    setItems(updated);
    saveToStorage(updated);
  };

  const todayItems = items.filter((item) => item.group === 'TODAY');
  const yesterdayItems = items.filter((item) => item.group === 'YESTERDAY');

  const renderGroup = (title: string, groupItems: NotificationItem[]) => {
    if (groupItems.length === 0) return null;

    return (
      <div className="space-y-3">
        <h2 className="text-[11px] font-extrabold tracking-widest text-zinc-400 dark:text-zinc-500 uppercase px-1">
          {title}
        </h2>
        <div className="space-y-2.5">
          {groupItems.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggleRead(item.id)}
              className="group/item flex items-center justify-between gap-3.5 px-4 py-4 rounded-[22px] bg-white dark:bg-[#16161c] border border-zinc-200/50 dark:border-zinc-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.02)] dark:shadow-none hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.99] transition-all duration-200 cursor-pointer relative overflow-hidden"
              id={`notification-${item.id}`}
            >
              {/* Unread Indicator on the Right Edge (Blue) */}
              {item.isUnread && (
                <div 
                  className="absolute right-0 top-0 bottom-0 w-[5px] bg-blue-500 dark:bg-blue-500 rounded-r-[22px] transition-all duration-300"
                  id={`unread-indicator-${item.id}`}
                />
              )}

              {/* Avatar Icon */}
              <div 
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${item.avatarBg} text-xs font-bold shadow-inner overflow-hidden`}
                id={`avatar-${item.id}`}
              >
                {item.id === 'welcome_kortex' ? (
                  <Activity size={24} className="text-white" />
                ) : (
                  item.avatar
                )}
              </div>

              {/* Text content */}
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] leading-snug">
                  <span className="font-extrabold text-zinc-800 dark:text-zinc-100 mr-1.5 font-sans">
                    {item.sender}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400 font-medium font-sans">
                    {item.text}
                  </span>
                </p>
              </div>

              {/* Timestamp */}
              <div 
                className={`text-[12px] font-bold font-mono tracking-tight shrink-0 transition-colors ${
                  item.isUnread 
                    ? 'text-blue-500 dark:text-blue-400 pr-2' 
                    : 'text-zinc-400 dark:text-zinc-500'
                }`}
                id={`time-${item.id}`}
              >
                {item.time}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0e0e12] text-zinc-900 dark:text-zinc-100 pb-24" id="notifications-page">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-14 pb-5" id="notifications-header">
        <button
          onClick={() => navigate('/profile')}
          className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 flex items-center justify-center shadow-sm active:scale-90 hover:scale-[1.03] transition-all cursor-pointer"
          id="back-profile-btn"
        >
          <ChevronLeft size={20} className="text-zinc-800 dark:text-zinc-100" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100 font-sans" id="notifications-title">
          Notifications
        </h1>
        <button
          onClick={handleMarkAllAsRead}
          className="font-sans text-xs font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer px-3.5 py-2.5 rounded-full border border-blue-500/20 dark:border-blue-450/10 hover:bg-blue-500/5 select-none"
          id="read-all-btn"
        >
          Read All
        </button>
      </div>

      {/* List Container with padding px-3 to matches Profile's items bounds */}
      <div className="px-3 space-y-7 max-w-lg mx-auto pt-2" id="notifications-list-container">
        {items.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center space-y-4" id="empty-state">
            <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-400">
              <Bell size={24} />
            </div>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No notifications yet
            </p>
          </div>
        ) : (
          <>
            {renderGroup('Today', todayItems)}
            {renderGroup('Yesterday', yesterdayItems)}
          </>
        )}
      </div>
    </div>
  );
}
