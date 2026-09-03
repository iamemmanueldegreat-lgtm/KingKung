import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ChevronLeft, Camera, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { compressImage } from '../lib/utils';
import { motion } from 'motion/react';

export default function EditProfile() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('Male');
  const [semester, setSemester] = useState<1 | 2>(1);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      const parts = (user.full_name || '').split(' ');
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setEmail(user.email || '');
      
      let phone = user.phone_number || '';
      if (phone.startsWith('+234')) {
        phone = '0' + phone.substring(4);
      } else if (phone.startsWith('234') && phone.length > 10) {
        phone = '0' + phone.substring(3);
      }
      setPhoneNumber(phone);
      setGender((user as any).gender || 'Male');
      setSemester(user.semester || 1);
    }
  }, [user]);

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
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      let cleanPhone = phoneNumber.trim().replace(/\s+/g, '');
      if (cleanPhone.startsWith('+234')) {
        cleanPhone = '0' + cleanPhone.substring(4);
      } else if (cleanPhone.startsWith('234') && cleanPhone.length > 10) {
        cleanPhone = '0' + cleanPhone.substring(3);
      }

      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        full_name: `${firstName} ${lastName}`.trim(),
        phone_number: cleanPhone,
        gender: gender,
        semester: semester,
      });
      toast.success('Profile updated successfully!');
      await refreshProfile();
      navigate('/profile');
    } catch (error: any) {
      toast.error('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0e0e12] text-zinc-900 dark:text-zinc-100 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-14 pb-4">
        <button
          onClick={() => navigate('/profile')}
          className="w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 flex items-center justify-center shadow-sm active:scale-[0.93] transition-all cursor-pointer"
        >
          <ChevronLeft size={20} className="text-zinc-800 dark:text-zinc-100" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-zinc-800 dark:text-zinc-100 font-sans">Edit Profile</h1>
        <div className="w-12" /> {/* alignment spacer */}
      </div>

      <div className="px-5 pt-6 pb-10 flex flex-col items-center">
        {/* Avatar */}
        <div className="relative mb-10 group">
          <button
            onClick={() => avatarInputRef.current?.click()}
            className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-[#e5e7eb] dark:ring-[#2C2D33] flex items-center justify-center bg-zinc-200 dark:bg-zinc-800 text-3xl font-bold relative"
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              (user?.full_name?.charAt(0) || 'U').toUpperCase()
            )}
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <Loader2 size={24} className="animate-spin text-white" />
              ) : (
                <Camera size={24} className="text-white" />
              )}
            </div>
          </button>
          <button 
             onClick={() => avatarInputRef.current?.click()}
             className="absolute bottom-0 right-0 w-8 h-8 bg-zinc-400 dark:bg-zinc-600 rounded-full border-2 border-[#f3f4f6] dark:border-[#1a1b1e] flex items-center justify-center text-white"
          >
            <Camera size={14} />
          </button>
        </div>
        <input type="file" ref={avatarInputRef} hidden accept="image/*" onChange={handleAvatarUpload} />

        <div className="w-full max-w-md space-y-5">
          <div className="flex gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block px-1">First Name</label>
              <input 
                type="text" 
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-all font-medium"
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block px-1">Last Name</label>
              <input 
                type="text" 
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block px-1">Email</label>
            <input 
              type="email" 
              value={email}
              disabled
              className="w-full bg-black/5 dark:bg-white/5 border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:outline-none opacity-70 font-medium cursor-not-allowed"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block px-1">Phone Number</label>
            <input 
              type="tel" 
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="e.g. 09153689632"
              className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block px-1">Current Semester</label>
            <div className="relative">
              <select 
                value={semester}
                onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)}
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-all font-medium appearance-none"
              >
                <option value={1} className="text-zinc-900 bg-white dark:bg-zinc-800 dark:text-white">1st Semester</option>
                <option value={2} className="text-zinc-900 bg-white dark:bg-zinc-800 dark:text-white">2nd Semester</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-400 block px-1">Gender</label>
            <div className="relative">
              <select 
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-2xl px-4 py-3.5 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-all font-medium appearance-none"
              >
                <option value="Male" className="text-zinc-900 bg-white dark:bg-zinc-800 dark:text-white">Male</option>
                <option value="Female" className="text-zinc-900 bg-white dark:bg-zinc-800 dark:text-white">Female</option>
                <option value="Other" className="text-zinc-900 bg-white dark:bg-zinc-800 dark:text-white">Other</option>
                <option value="Prefer not to say" className="text-zinc-900 bg-white dark:bg-zinc-800 dark:text-white">Prefer not to say</option>
              </select>
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-zinc-500">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              </div>
            </div>
          </div>

        </div>

        <motion.button
          onClick={handleSave}
          disabled={isSaving}
          whileTap={{ scale: 0.98 }}
          className="mt-10 w-full max-w-md py-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer"
        >
          {isSaving ? <Loader2 size={20} className="animate-spin text-white" /> : 'Save Changes'}
        </motion.button>
      </div>
    </div>
  );
}
