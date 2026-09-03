import React, { useState, useEffect } from 'react';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { toast } from 'react-hot-toast';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidCode, setIsValidCode] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setIsValidCode(false);
        return;
      }
      try {
        await verifyPasswordResetCode(auth, oobCode);
        setIsValidCode(true);
      } catch (error) {
        console.error("Invalid or expired action code", error);
        setIsValidCode(false);
      }
    };
    verifyCode();
  }, [oobCode]);

  const handleResetPassword = async () => {
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!oobCode) return;

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      toast.success('Password has been reset successfully!');
      setTimeout(() => navigate('/auth'), 2000);
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Failed to reset password');
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
            <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-[#E2E8F0] pr-4">
              Secure your account with new passwords
            </h1>
            <p className="text-[14px] text-white/60 font-medium leading-relaxed">
              Create a strong password to secure your account now.
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="flex-1 bg-[#f4f6fa] rounded-t-[32px] px-6 pt-10 pb-10 flex flex-col z-10 relative overflow-y-auto mt-2 custom-scrollbar">
          {isValidCode === false ? (
            <div className="text-center mt-10">
              <p className="text-[#1E293B] font-semibold">Invalid or expired reset link.</p>
              <button 
                  onClick={() => navigate('/forgot-password')}
                  className="mt-6 w-full bg-[#112324] text-white rounded-[20px] py-4 font-semibold text-[15px]"
                >
                  Request a new link
                </button>
            </div>
          ) : isValidCode === null ? (
            <div className="flex justify-center mt-10">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#112324]"></div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5 flex-1 flex flex-col"
            >
              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5 ml-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-white border border-gray-200 rounded-[20px] px-4 py-4 text-[15px] font-medium text-[#1E293B] outline-none focus:border-[#112324]/50 focus:ring-2 focus:ring-[#112324]/10 transition-all placeholder:text-[#94A3B8] placeholder:font-normal"
                    placeholder="Enter your new password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#64748B] mb-1.5 ml-1">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    className="w-full bg-white border border-gray-200 rounded-[20px] px-4 py-4 text-[15px] font-medium text-[#1E293B] outline-none focus:border-[#112324]/50 focus:ring-2 focus:ring-[#112324]/10 transition-all placeholder:text-[#94A3B8] placeholder:font-normal"
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] transition-colors p-1"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="mt-8">
                <button 
                  onClick={handleResetPassword}
                  disabled={loading || !password || !confirmPassword}
                  className="w-full bg-[#112324] hover:bg-[#112324]/90 text-white rounded-[20px] py-4 font-semibold text-[15px] transition-all active:scale-[0.98] shadow-[0_8px_20px_rgba(17,35,36,0.15)] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
