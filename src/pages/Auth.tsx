import React, { useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Eye, EyeOff, X, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NIGERIAN_SCHOOLS, NIGERIAN_STATES, STANDARD_DEPARTMENTS, POLYTECHNIC_DEPARTMENTS, UNIVERSITY_LEVELS, POLYTECHNIC_LEVELS, isPolytechnic } from '../lib/constants';

import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

function getAuthErrorMessage(error: any): string {
  switch (error?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password. Please try again.';
    case 'auth/user-not-found':
      return 'No account found with that email address.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Please wait a moment and try again.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email address.';
    case 'auth/weak-password':
      return 'Your password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function BottomSheetPicker({ 
  isOpen, 
  onClose, 
  options, 
  value, 
  onSelect, 
  title 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  options: string[]; 
  value: string; 
  onSelect: (val: string) => void; 
  title: string; 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm transition-opacity">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full sm:w-[400px] max-h-[75vh] bg-surface dark:bg-[#1a1a1a] rounded-t-[32px] sm:rounded-3xl p-6 flex flex-col shadow-2xl relative z-10"
      >
        <div className="flex items-center justify-between mb-5">
           <h3 className="font-bold text-lg text-text">{title}</h3>
           <button onClick={onClose} type="button" className="p-2 rounded-full bg-zinc-100 dark:bg-white/10 text-text hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors">
             <X size={18} />
           </button>
        </div>
        <div className="overflow-y-auto flex-1 space-y-2 custom-scrollbar pr-2 pb-6">
           {options.map(opt => (
             <button
               key={opt}
               type="button"
               onClick={() => { onSelect(opt); onClose(); }}
               className={`w-full text-left p-4 rounded-xl font-bold transition-all border ${
                 value === opt 
                   ? 'bg-[#14333c] border-[#14333c] text-white shadow-md' 
                   : 'bg-zinc-50 dark:bg-white/5 border-border dark:border-white/10 hover:border-[#14333c]/50 text-text'
               }`}
             >
               {opt}
             </button>
           ))}
           {options.length === 0 && (
             <p className="text-sm text-center text-muted py-8">No options available</p>
           )}
        </div>
      </motion.div>
    </div>
  );
}

export default function Auth() {
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [openPicker, setOpenPicker] = useState<'state' | 'school' | 'department' | null>(null);
  const [isLogin, setIsLogin] = useState(() => !!localStorage.getItem('kortex_returning_user'));
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    phoneNumber: '',
    password: '',
    firstName: '',
    lastName: '',
    state: '',
    school: '',
    department: '',
    level: ''
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLogin) {
      if (step < 3) {
        nextStep();
        return;
      }
      if (formData.password !== confirmPassword) {
        toast.error("Passwords do not match!");
        return;
      }
      if (!formData.department) {
        toast.error("Please select your department");
        return;
      }
      if (!formData.level) {
        toast.error("Please select your current level");
        return;
      }
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, formData.email, formData.password);
        localStorage.setItem('kortex_returning_user', '1');
        toast.success("Welcome back!");
        await refreshProfile();
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        if (user) {
          try {
            await setDoc(doc(db, 'users', user.uid), {
              id: user.uid,
              email: formData.email,
              phone_number: formData.phoneNumber,
              full_name: `${formData.firstName} ${formData.lastName}`.trim(),
              state: formData.state,
              school: formData.school,
              department: formData.department,
              level: formData.level,
              is_pro: false
            });
            await refreshProfile();
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}`);
          }
        }
        toast.success("Account created successfully!");
      }
    } catch (error: any) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1) {
      if (!formData.firstName.trim()) {
        toast.error("Please enter first name");
        return;
      }
      if (!formData.lastName.trim()) {
        toast.error("Please enter last name");
        return;
      }
      if (!formData.email.trim()) {
        toast.error("Please enter an email address");
        return;
      }
      if (!formData.phoneNumber.trim()) {
        toast.error("Please enter your phone number");
        return;
      }
      if (!formData.password) {
        toast.error("Please enter a password");
        return;
      }
      if (formData.password.length < 6) {
        toast.error("Password must be at least 6 characters");
        return;
      }
      if (formData.password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    } else if (step === 2) {
      if (!formData.state) {
        toast.error("Please select state of institution");
        return;
      }
      if (!formData.school) {
        toast.error("Please enter or select institution name");
        return;
      }
    }
    setStep(step + 1);
  };
  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-[100dvh] bg-background md:bg-[#F3F4F6] flex justify-center items-center font-sans overflow-hidden">
      <div className="w-full h-[100dvh] md:h-[85vh] md:max-h-[850px] md:max-w-[400px] md:rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] flex flex-col bg-[#14333c] relative overflow-hidden">
        
        {/* Elegant rounded-corner tile grid background inspired by the design */}
        <div className="absolute top-[-2%] left-[-2%] right-[-2%] h-[44%] overflow-hidden pointer-events-none z-0">
          <div className="grid grid-cols-4 gap-3.5 p-6">
            {Array.from({ length: 16 }).map((_, i) => (
              <div 
                key={i} 
                className="aspect-square rounded-[22px] border border-white/[0.07] bg-gradient-to-br from-white/[0.02] to-transparent shadow-[inset_0_1.5px_2px_rgba(255,255,255,0.035)]"
              />
            ))}
          </div>
        </div>

        {/* Header Section (Dark Phase) — compact on small viewports */}
        <div className="px-6 pt-5 sm:pt-8 pb-6 sm:pb-14 flex flex-col z-0 transition-all duration-500 text-white relative">
          <button 
            onClick={() => {
              if (!isLogin && step > 1) {
                prevStep();
              } else {
                navigate(-1);
              }
            }}
            className="w-11 h-11 bg-white/[0.04] border border-white/10 rounded-[16px] flex items-center justify-center mb-4 sm:mb-8 transition-colors hover:bg-white/[0.08]"
          >
            <ArrowLeft size={18} className="text-white/90" />
          </button>
          
          <AnimatePresence mode="wait">
            <motion.div 
              key={isLogin ? 'login' : `signup-${step}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-2 sm:space-y-3"
            >
              <h1 className="text-[22px] sm:text-[28px] font-semibold leading-[1.18] tracking-tight">
                {isLogin 
                  ? "Go ahead and complete your account and setup" 
                  : step === 1 
                    ? "Sign up now to access your personal account"
                    : step === 2
                      ? "Select your institution for a tailored experience"
                      : "Finalizing your academic profile"
                }
              </h1>
              <p className="text-white/60 text-[13px] sm:text-[15px] font-medium leading-snug">
                {isLogin 
                  ? "Create your account and simplify your workflow instantly."
                  : step === 1 
                    ? "Sign up to access your account and exclusive features."
                    : step === 2
                      ? "Help us find the best resources for your school."
                      : "We'll customize your dashboard based on this."
                }
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Form Section (Theme-Aware) */}
        <div className="flex-1 bg-background dark:bg-card rounded-t-[36px] px-6 pt-5 sm:pt-8 pb-8 flex flex-col z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.2)] relative overflow-y-auto custom-scrollbar border-t border-white/10">
          
          {/* Toggle Switch */}
          <div className="bg-muted/10 dark:bg-white/5 rounded-2xl p-1.5 flex mb-5 sm:mb-8 border border-border/50">
            <button 
              type="button"
              onClick={() => { setIsLogin(true); setStep(1); setConfirmPassword(''); }}
              className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all duration-300 ${isLogin ? 'bg-white shadow-md text-[#14333c] font-black' : 'text-muted/60 dark:text-white/40 hover:text-text/80'}`}
            >
              Log In
            </button>
            <button 
              type="button"
              onClick={() => { setIsLogin(false); setConfirmPassword(''); }}
              className={`flex-1 py-3 text-[14px] font-bold rounded-xl transition-all duration-300 ${!isLogin ? 'bg-white shadow-md text-[#14333c] font-black' : 'text-muted/60 dark:text-white/40 hover:text-text/80'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="flex-1 flex flex-col">
            {isLogin ? (
              <motion.div 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                className="space-y-5 flex-1 flex flex-col"
              >
                <div>
                  <label className="block text-[12px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-5 py-4 text-[15px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all placeholder:text-muted/40"
                    placeholder="student@uni.edu.ng"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-2 ml-1">Secure Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl pl-5 pr-12 py-4 text-[15px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all placeholder:text-muted/40"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-[#14333c] transition-colors p-1"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 pb-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input type="checkbox" className="w-5 h-5 rounded-lg border-border text-[#14333c] cursor-pointer focus:ring-[#14333c]/20 accent-[#14333c]" />
                    </div>
                    <span className="text-[13px] font-bold text-muted group-hover:text-text transition-colors">Stay Logged In</span>
                  </label>
                  <button type="button" onClick={() => navigate('/forgot-password')} className="text-[13px] font-black text-[#14333c] hover:underline transition-colors">
                    Reset Access
                  </button>
                </div>

                <button disabled={loading} className="w-full bg-[#14333c] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl py-4.5 font-black text-[16px] transition-all shadow-xl shadow-[#14333c]/15 disabled:opacity-70 mt-auto">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                       <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                       Authenticating...
                    </div>
                  ) : "Enter Dashboard"}
                </button>

              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col">
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 flex-1 flex flex-col">
                    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">First Name</label>
                        <input
                          type="text"
                          required
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all"
                          placeholder="Wade"
                          value={formData.firstName}
                          onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Last Name</label>
                        <input
                          type="text"
                          required
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all"
                          placeholder="Warren"
                          value={formData.lastName}
                          onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                        <input
                          type="email"
                          required
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all"
                          placeholder="student@uni.edu.ng"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number</label>
                        <input
                          type="tel"
                          required
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all"
                          placeholder="08012345678"
                          value={formData.phoneNumber}
                          onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl pl-4 pr-12 py-4 text-[14px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all"
                          placeholder="••••••••"
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted hover:text-[#14333c] transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl pl-4 pr-12 py-4 text-[14px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all"
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    <button type="button" onClick={nextStep} className="w-full bg-[#14333c] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl py-4 font-black text-[15px] transition-all shadow-xl mt-auto mt-6">
                      Create Profile
                    </button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 flex-1 flex flex-col">
                    <div>
                      <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">State of Institution</label>
                      <button
                        type="button"
                        onClick={() => setOpenPicker('state')}
                        className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text text-left outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all flex items-center justify-between"
                      >
                        <span className={formData.state ? 'text-text line-clamp-1' : 'text-muted'}>{formData.state || "Select your state"}</span>
                        <ChevronDown size={18} className="text-muted shrink-0 ml-2" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Institution Name</label>
                      {NIGERIAN_SCHOOLS[formData.state]?.length ? (
                        <button
                          type="button"
                          onClick={() => setOpenPicker('school')}
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text text-left outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all flex items-center justify-between"
                        >
                          <span className={formData.school ? 'text-text line-clamp-1' : 'text-muted'}>{formData.school || "Select your institution"}</span>
                          <ChevronDown size={18} className="text-muted shrink-0 ml-2" />
                        </button>
                      ) : (
                        <input
                          type="text"
                          required
                          className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all"
                          placeholder="Type your institution name"
                          value={formData.school}
                          onChange={e => setFormData({ ...formData, school: e.target.value, department: '', level: '' })}
                        />
                      )}
                    </div>
                    <button type="button" onClick={nextStep} className="w-full bg-[#14333c] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl py-4 font-black text-[15px] transition-all shadow-xl mt-auto mt-6">
                      Continue Step 2/3
                    </button>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4 flex-1 flex flex-col">
                    <div>
                      <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Academic Department</label>
                      <button
                        type="button"
                        onClick={() => setOpenPicker('department')}
                        className="w-full bg-surface dark:bg-white/5 border border-border dark:border-white/10 rounded-2xl px-4 py-4 text-[14px] font-semibold text-text text-left outline-none focus:border-[#14333c] focus:ring-4 focus:ring-[#14333c]/10 transition-all flex items-center justify-between"
                      >
                        <span className={formData.department ? 'text-text line-clamp-1' : 'text-muted'}>{formData.department || "Select your department"}</span>
                        <ChevronDown size={18} className="text-muted shrink-0 ml-2" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-[#14333c]/80 dark:text-teal-400 uppercase tracking-widest mb-1.5 ml-1">Current Level</label>
                      <div className={`grid gap-2 ${isPolytechnic(formData.school) ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {(isPolytechnic(formData.school) ? POLYTECHNIC_LEVELS : UNIVERSITY_LEVELS).map(l => (
                          <button
                            key={l}
                            type="button"
                            onClick={() => setFormData({ ...formData, level: l })}
                            className={`py-2.5 rounded-xl border text-[11px] font-black transition-all ${formData.level === l ? 'bg-[#14333c] text-white border-[#14333c] shadow-lg' : 'bg-surface dark:bg-white/5 border-border dark:border-white/10 text-text hover:border-[#14333c]/50'}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button disabled={loading} className="w-full bg-[#14333c] hover:opacity-95 active:scale-[0.98] text-white rounded-2xl py-4.5 font-black text-[16px] transition-all shadow-xl disabled:opacity-70 mt-auto mt-6">
                       {loading ? "Registering..." : "Finalize & Join Platform"}
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </form>
        </div>
      </div>

      <AnimatePresence>
        {openPicker === 'state' && (
          <BottomSheetPicker
            isOpen={true}
            onClose={() => setOpenPicker(null)}
            title="Select your state"
            options={NIGERIAN_STATES}
            value={formData.state}
            onSelect={(val) => setFormData({ ...formData, state: val, school: '', department: '', level: '' })}
          />
        )}
        {openPicker === 'school' && (
          <BottomSheetPicker
            isOpen={true}
            onClose={() => setOpenPicker(null)}
            title="Select your institution"
            options={NIGERIAN_SCHOOLS[formData.state] || []}
            value={formData.school}
            onSelect={(val) => setFormData({ ...formData, school: val, department: '', level: '' })}
          />
        )}
        {openPicker === 'department' && (
          <BottomSheetPicker
            isOpen={true}
            onClose={() => setOpenPicker(null)}
            title="Select your department"
            options={isPolytechnic(formData.school) ? POLYTECHNIC_DEPARTMENTS : STANDARD_DEPARTMENTS}
            value={formData.department}
            onSelect={(val) => setFormData({ ...formData, department: val })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

