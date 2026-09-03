import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChevronLeft, GraduationCap, Lock, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'react-hot-toast';

export default function AcademicProfile() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const school = user?.school || '';
  const department = user?.department || '';
  const level = user?.level || '';
  const state = user?.state || '';
  const country = (user as any)?.country || 'Nigeria';
  const currentSemester = user?.semester || 1;

  const [savingSemester, setSavingSemester] = useState(false);

  const handleSelectSemester = async (sem: 1 | 2) => {
    if (!user || sem === currentSemester || savingSemester) return;
    setSavingSemester(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { semester: sem });
      await refreshProfile();
      toast.success(`Current semester updated to ${sem === 1 ? '1st' : '2nd'} Semester!`);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update semester');
    } finally {
      setSavingSemester(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0e0e12] text-zinc-900 dark:text-zinc-100 flex flex-col pb-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-14 pb-4 shrink-0">
        <button
          onClick={() => navigate('/profile')}
          className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 flex items-center justify-center shadow-sm active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} className="text-zinc-800 dark:text-zinc-100" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100 font-sans">Academic Profile</h1>
        <div className="w-12" /> {/* alignment spacer */}
      </div>

      <div className="flex-1 w-full px-4 pt-2 pb-10 flex flex-col items-center max-w-lg mx-auto">
        
        {/* Profile Avatar / Graduation Icon Badge */}
        <div className="relative mb-6 shrink-0">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white dark:ring-zinc-900 shadow-md flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <GraduationCap size={40} className="stroke-[1.75]" />
          </div>
        </div>

        {/* Form fields */}
        <div className="w-full space-y-4">
          
          {/* Current Semester Selector */}
          <div className="space-y-1.5 p-4 bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black uppercase tracking-wider text-zinc-800 dark:text-zinc-200 block">
                Current Semester
              </label>
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                Controls courses shown in Library
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              {([1, 2] as const).map(s => {
                const isSelected = currentSemester === s;
                return (
                  <button
                    key={s}
                    disabled={savingSemester}
                    onClick={() => handleSelectSemester(s)}
                    className={`py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 shadow-md scale-[1.02]'
                        : 'bg-white dark:bg-[#16161c] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                    }`}
                  >
                    {s === 1 ? '1st Semester' : '2nd Semester'}
                    {isSelected && <Check size={14} className="stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 block px-1">
              University / School
            </label>
            <div className="w-full bg-white dark:bg-[#16161c] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl px-4 py-3.5 text-[15px] font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-between shadow-sm">
              <span className="truncate pr-4">{school || 'No school provided'}</span>
              <Lock size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 block px-1">
              Department / Course
            </label>
            <div className="w-full bg-white dark:bg-[#16161c] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl px-4 py-3.5 text-[15px] font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-between shadow-sm">
              <span className="truncate pr-4">{department || 'No department provided'}</span>
              <Lock size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 block px-1">
              Academic Level
            </label>
            <div className="w-full bg-white dark:bg-[#16161c] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl px-4 py-3.5 text-[15px] font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-between shadow-sm">
              <span>{level || 'No level configured'}</span>
              <Lock size={14} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 block px-1">
                State
              </label>
              <div className="w-full bg-white dark:bg-[#16161c] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl px-4 py-3.5 text-[15px] font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-between shadow-sm">
                <span className="truncate">{state || 'No state'}</span>
                <Lock size={12} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-zinc-500 dark:text-zinc-400 block px-1">
                Country
              </label>
              <div className="w-full bg-white dark:bg-[#16161c] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl px-4 py-3.5 text-[15px] font-bold text-zinc-800 dark:text-zinc-100 flex items-center justify-between shadow-sm">
                <span className="truncate">{country || 'Nigeria'}</span>
                <Lock size={12} className="text-zinc-300 dark:text-zinc-600 shrink-0" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
