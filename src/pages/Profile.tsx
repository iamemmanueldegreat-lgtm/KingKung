import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LogOut, ChevronRight, ChevronLeft, Shield, Bell, ExternalLink,
  Camera, Loader2, Crown, Download, Smartphone, Share,
  Plus, X, CheckCircle2, GraduationCap, Pencil, BookOpen, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { usePWA } from '../hooks/usePWA';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { compressImage } from '../lib/utils';

export default function Profile() {
  const { user, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const { isInstalled, installable, isIPhone, triggerInstall } = usePWA();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    try {
      const base64Url = await compressImage(file, 400, 400);
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { avatar_url: base64Url });
      toast.success('Profile picture updated!');
      await refreshProfile();
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to upload image. Please check file format.');
      try {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
      } catch(e) {}
    } finally {
      setUploadingAvatar(false);
    }
  };

  const accountItems = [
    {
      icon: <Pencil size={18} />,
      label: 'Edit Profile',
      color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200',
      onClick: () => navigate('/edit-profile'),
    },
    {
      icon: <GraduationCap size={18} />,
      label: 'Academic Profile',
      color: 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400',
      onClick: () => navigate('/academic-profile'),
    },
    {
      icon: <Bell size={18} />,
      label: 'Notifications',
      color: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400',
      onClick: () => navigate('/notifications'),
    },
    {
      icon: <Shield size={18} />,
      label: 'Security & Privacy',
      color: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      onClick: () => {},
    },
  ];

  const settingsItems = [
    ...(!isIPhone ? [{
      icon: <Smartphone size={18} />,
      label: isInstalled ? 'App Installed' : 'Install App',
      color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200',
      onClick: async () => {
        if (isInstalled) return;
        if (installable) {
          const ok = await triggerInstall();
          if (ok) toast.success('Thank you for installing Kortex AI!');
        } else {
          toast.success('App installation initiated! Try your Chrome/browser settings for "Install App" if the prompt is blocked.');
        }
      },
      trailing: isInstalled
        ? <CheckCircle2 size={16} className="text-emerald-500" />
        : undefined,
    }] : []),
    {
      icon: <ExternalLink size={18} />,
      label: 'Help & Support',
      color: 'bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400',
      onClick: () => {},
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0e0e12] pb-28 max-w-2xl mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-14 pb-5">
        <button
          onClick={() => navigate('/')}
          className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 flex items-center justify-center shadow-sm active:scale-90 hover:scale-[1.03] transition-all"
        >
          <ChevronLeft size={20} className="text-zinc-800 dark:text-zinc-100" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100 font-sans">Profile</h1>
        <button
          onClick={() => navigate('/edit-profile')}
          className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 flex items-center justify-center shadow-sm active:scale-90 hover:scale-[1.03] transition-all"
          title="Edit Profile"
        >
          <Pencil size={18} className="text-zinc-800 dark:text-zinc-100" />
        </button>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center pt-3 pb-8 px-4 sm:px-6">
        <div className="relative group mb-4">
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-white dark:ring-zinc-900 shadow-md flex items-center justify-center bg-primary text-white text-3xl font-bold relative transition-transform hover:scale-[1.02]"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              user?.full_name?.charAt(0).toUpperCase() || 'U'
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
              {uploadingAvatar
                ? <Loader2 size={24} className="animate-spin text-white" />
                : <Camera size={22} className="text-white" />}
            </div>
          </button>

          {user?.is_pro && (
            <div className="absolute bottom-1 right-1 bg-amber-500 text-white p-1.5 rounded-full border-2 border-white dark:border-[#0e0e12] shadow-sm">
              <Crown size={12} fill="currentColor" />
            </div>
          )}
        </div>

        <input
          type="file"
          ref={avatarInputRef}
          hidden
          accept="image/*"
          onChange={handleAvatarUpload}
        />

        <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
          {user?.full_name || 'Student User'}
        </h2>
        <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mt-1">{user?.email}</p>
        
        {user?.school && (
          <span className="mt-3.5 px-3 py-1 bg-primary/10 text-primary dark:text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-wider border border-primary/20">
            {user.school}
          </span>
        )}
      </div>

      <div className="px-4 sm:px-6 space-y-6 w-full mx-auto">

        {/* Portals & Premium Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Admin Panel */}
          {user?.is_admin && (
            <motion.button
              onClick={() => navigate('/admin')}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-start gap-4 w-full bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-[24px] p-5 border border-amber-500/20 shadow-sm text-left active:scale-[0.99] transition-all overflow-hidden relative"
            >
              <div className="w-10 h-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/25">
                <Shield size={18} fill="currentColor" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 mb-0.5">Workspace</p>
                <p className="text-[15px] font-bold text-white leading-tight">Admin Portal</p>
              </div>
            </motion.button>
          )}

          {/* Rep Portal */}
          {user?.is_rep && (
            <motion.button
              onClick={() => navigate('/rep')}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-start gap-4 w-full bg-gradient-to-br from-[#1A1A1D] to-[#2D2D34] dark:from-zinc-900 dark:to-zinc-800 text-white rounded-[24px] p-5 border border-[#40404A] dark:border-zinc-700 shadow-sm text-left active:scale-[0.99] transition-all overflow-hidden relative"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center shrink-0 border border-white/5">
                <Wallet size={18} fill="currentColor" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-0.5">Earnings</p>
                <p className="text-[15px] font-bold text-white leading-tight">Rep Portal</p>
              </div>
            </motion.button>
          )}

          {/* Premium / Upgrade Banner */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/billing')}
            className={`flex flex-col items-start gap-4 w-full rounded-[24px] p-5 shadow-sm text-left active:scale-[0.99] transition-all border overflow-hidden relative ${
              user?.is_admin || user?.is_rep ? 'col-span-1' : 'col-span-2 flex-row items-center !px-6 !py-5'
            } bg-gradient-to-br from-primary to-primary/90 border-primary/20 text-white`}
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/10">
              <Crown size={18} className="text-white" fill="currentColor" />
            </div>
            <div className={`${(user?.is_admin || user?.is_rep) ? '' : 'flex-1 ml-1'}`}>
              <p className={`text-[10px] font-black uppercase tracking-widest text-white/70 mb-0.5`}>Subscription</p>
              <p className="text-[15px] font-bold text-white leading-tight">
                {user?.is_pro ? 'Premium Active 👑' : 'Upgrade to Pro'}
              </p>
              {!(user?.is_admin || user?.is_rep) && (
                <p className="text-[11px] opacity-80 mt-1 leading-tight font-medium max-w-[240px]">
                  {user?.is_pro
                    ? 'Your premium access is active.'
                    : 'Unlock AI tutor & smart features.'}
                </p>
              )}
            </div>
            {!(user?.is_admin || user?.is_rep) && (
               <ChevronRight size={20} className="text-white/60 ml-auto" />
            )}
          </motion.button>
        </div>

        {/* Account Settings Section */}
        <div>
          <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 px-1 mb-3">
            User information
          </p>
          <div className="space-y-3">
            {accountItems.map((item, i) => (
              <button
                key={i}
                onClick={item.onClick}
                className="w-full h-16 flex items-center justify-between px-4 bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[20px] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.99] transition-all text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-zinc-150/50 dark:border-zinc-800/40 ${item.color}`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-bold text-zinc-850 dark:text-zinc-200">{item.label}</span>
                </div>
                <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Academic Details (Disabled Display in clean format) */}
        <div>
          <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 px-1 mb-3">
            Academic Status
          </p>
          <div className="bg-white dark:bg-[#16161c] border border-zinc-200/80 dark:border-zinc-800/80 rounded-[24px] px-5 py-1.5 shadow-sm">
            {[
              { label: 'Department / Course', value: user?.department, color: 'text-violet-500' },
              { label: 'Academic Level', value: user?.level, color: 'text-emerald-500' },
              { label: 'Current State', value: user?.state, color: 'text-rose-500' },
            ].map((item, i, arr) => (
              <div
                key={i}
                className={`flex items-center justify-between py-4 ${
                  i < arr.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800/60' : ''
                }`}
              >
                <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-400 uppercase tracking-wider">{item.label}</span>
                <span className="text-[14px] font-bold text-zinc-800 dark:text-zinc-100">{item.value || 'Not configured'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Settings Section */}
        <div>
          <p className="text-[13px] font-bold text-zinc-800 dark:text-zinc-200 px-1 mb-3">
            Application Settings
          </p>
          <div className="space-y-3">
            {settingsItems.map((item, i) => (
              <button
                key={i}
                onClick={item.onClick}
                className="w-full h-16 flex items-center justify-between px-4 bg-white dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-[20px] shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 active:scale-[0.99] transition-all text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-zinc-200/30 dark:border-zinc-800/40 ${item.color}`}>
                    {item.icon}
                  </div>
                  <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{item.label}</span>
                </div>
                {item.trailing ?? <ChevronRight size={18} className="text-zinc-400 dark:text-zinc-500 shrink-0" />}
              </button>
            ))}

            {/* Sign Out */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full h-16 flex items-center justify-between px-4 bg-white dark:bg-zinc-900/40 border border-red-200/80 dark:border-red-900/30 rounded-[20px] shadow-sm hover:bg-red-50/50 dark:hover:bg-red-950/10 active:scale-[0.99] transition-all text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-500/15 text-red-500 border border-red-200/30 dark:border-red-500/10">
                  <LogOut size={18} />
                </div>
                <span className="text-sm font-bold text-red-500">Log Out</span>
              </div>
              <ChevronRight size={18} className="text-red-300 dark:text-red-900 shrink-0" />
            </button>
          </div>
        </div>

        <p className="text-center text-[10px] text-muted/50 uppercase tracking-[0.3em] font-bold pt-2 pb-4">
          Kortex AI · v1.0.0
        </p>
      </div>



      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[9999] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div 
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px] cursor-pointer"
            />
            
            {/* Sheet Body */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 300 }}
              dragElastic={0.15}
              onDragEnd={(e, info) => {
                if (info.offset.y > 80) {
                  setShowLogoutConfirm(false);
                }
              }}
              className="relative w-full bg-white dark:bg-[#121218] border-t border-zinc-200/80 dark:border-white/10 rounded-t-[32px] p-6 text-text pb-12 shadow-[0_-8px_30px_rgb(0,0,0,0.12)] z-10 touch-none"
            >
              {/* pull handle for mobile sheet vibe */}
              <div className="w-12 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-5"></div>

              {/* Titlebar Row */}
              <div className="relative w-full flex items-center justify-center pb-4 border-b border-zinc-100 dark:border-zinc-800/60 mb-6">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="absolute left-0 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-850 text-zinc-500 dark:text-zinc-400 cursor-pointer transition-colors"
                >
                  <X size={20} className="stroke-[2.5]" />
                </button>
                <span className="font-extrabold text-lg text-red-500">Logout</span>
              </div>

              {/* Centered Content */}
              <div className="flex flex-col items-center text-center">
                <h4 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white leading-tight mb-2">
                  Are you sure want to Logout?
                </h4>
                <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
                  Thank you and see you again! ❤️
                </p>

                {/* Button actions row */}
                <div className="flex w-full gap-3">
                  <button
                    type="button"
                    onClick={() => setShowLogoutConfirm(false)}
                    className="flex-1 py-3.5 text-sm font-bold text-[#10b981] dark:text-[#a3e635] bg-[#ecfdf5] dark:bg-emerald-950/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-full transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="flex-1 py-3.5 text-sm font-bold text-white bg-[#10b981] hover:bg-[#0e9f6e] rounded-full transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/10 cursor-pointer"
                  >
                    Yes, Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
