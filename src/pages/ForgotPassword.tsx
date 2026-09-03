import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { toast } from 'react-hot-toast';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleContinue = async () => {
    if (!email && !phone) {
      toast.error('Please enter your email or phone number');
      return;
    }

    setLoading(true);
    try {
      // For now we use Firebase Auth's native sendPasswordResetEmail since we don't have a backend to route MailJet directly.
      // Firebase can be configured to use Mailjet as its custom SMTP provider in the Firebase Console!
      if (email) {
        const actionCodeSettings = {
          url: `${window.location.origin}/reset-password`,
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
        setEmailSent(true);
      } else {
         toast.error('Phone reset not yet configured, please use email.');
      }
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast.error(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background md:bg-[#F3F4F6] flex justify-center items-center font-sans overflow-hidden">
      <div className="w-full h-[100dvh] md:h-[85vh] md:max-h-[850px] md:max-w-[400px] md:rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.1)] flex flex-col bg-[#112324] relative overflow-hidden">
        
        {/* Header Section */}
        <div className="px-6 pt-14 pb-8 flex flex-col z-0 transition-all duration-500 text-white relative">
          <button 
            onClick={() => navigate('/auth')}
            className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center mb-8 border border-white/10 transition-colors backdrop-blur-sm"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          
          <div className="space-y-3">
            <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-[#E2E8F0]">
              Use phone or email to reset your password.
            </h1>
            <p className="text-[14px] text-white/60 font-medium leading-relaxed max-w-[280px]">
              Enter your email or phone to reset your password easily.
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 bg-[#f4f6fa] rounded-t-[32px] px-6 pt-10 pb-10 flex flex-col z-10 relative overflow-y-auto mt-2">
          <AnimatePresence mode="wait">
            {!emailSent ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-5 flex-1 flex flex-col"
              >
                <div>
                  <label className="block text-[13px] font-medium text-[#64748B] mb-1.5 ml-1">Email</label>
                  <input
                    type="email"
                    className="w-full bg-white border border-gray-200 rounded-[20px] px-4 py-4 text-[15px] font-medium text-[#1E293B] outline-none focus:border-[#112324]/50 focus:ring-2 focus:ring-[#112324]/10 transition-all placeholder:text-[#94A3B8] placeholder:font-normal"
                    placeholder="student@uni.edu.ng"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#64748B] mb-1.5 ml-1">Phone</label>
                  <input
                    type="tel"
                    className="w-full bg-white border border-gray-200 rounded-[20px] px-4 py-4 text-[15px] font-medium text-[#1E293B] outline-none focus:border-[#112324]/50 focus:ring-2 focus:ring-[#112324]/10 transition-all placeholder:text-[#94A3B8] placeholder:font-normal"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>

                <div className="mt-8">
                  <button 
                    onClick={handleContinue}
                    disabled={loading || (!email && !phone)}
                    className="w-full bg-[#112324] hover:bg-[#112324]/90 text-white rounded-[20px] py-4 font-semibold text-[15px] transition-all active:scale-[0.98] shadow-[0_8px_20px_rgba(17,35,36,0.15)] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? "Sending..." : "Continue"}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[28px] p-8 flex flex-col items-center justify-center text-center shadow-sm relative mt-10"
              >
                <div className="w-16 h-16 bg-[#112324] rounded-full flex items-center justify-center absolute -top-8 border-4 border-[#f4f6fa]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                
                <h3 className="text-xl font-bold text-[#1E293B] mt-6 mb-3">Check your email</h3>
                <p className="text-[14px] text-[#64748B] font-medium leading-relaxed mb-8">
                  Instructions to recover your password have been sent. Please check your email now.
                </p>

                <button 
                  onClick={() => window.location.href = `mailto:`}
                  className="w-full bg-[#112324] hover:bg-[#112324]/90 text-white rounded-[16px] py-3.5 font-semibold text-[14px] transition-all active:scale-[0.98]"
                >
                  Check Email
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
