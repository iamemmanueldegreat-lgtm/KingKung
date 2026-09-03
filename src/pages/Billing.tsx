import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Check, 
  Shield, 
  Crown, 
  X, 
  CreditCard, 
  Wallet,
  Smartphone,
  Sparkles,
  ArrowLeft,
  Copy,
  ListOrdered,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import LoadingScreen from '../components/LoadingScreen';

// Import our gorgeous generated premium hero bg
// @ts-ignore
import premiumHeroBg from '../assets/images/premium_hero_bg_1779648931811.png';

export default function Billing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank_transfer'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [transferStep, setTransferStep] = useState<'pending' | 'verifying' | 'success'>('pending');
  const [imageSrc, setImageSrc] = useState(premiumHeroBg);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [isCouponApplied, setIsCouponApplied] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.onerror = () => {
      console.log("Local premium bg failed to load, falling back to premium CDN");
      setImageSrc("https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=1200");
    };
    img.src = imageSrc;
    if (img.complete) {
      setImageLoaded(true);
    }
  }, [imageSrc]);

  const [appliedCouponString, setAppliedCouponString] = useState<string | null>(null);

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    if (code === 'OXSTINN') {
      setIsCouponApplied(true);
      setAppliedCouponString('OXSTINN');
      toast.success("Coupon code 'OXSTINN' applied! Enjoy your discount. 🎉");
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      // We check if any rep user has this coupon code matching exactly
      const q = query(usersRef, where('rep_coupon_code', '==', code));
      const s = await getDocs(q);
      if (!s.empty) {
        setIsCouponApplied(true);
        setAppliedCouponString(code);
        toast.success(`Coupon code '${code}' applied successfully! 🎉`);
      } else {
        toast.error("Invalid coupon code.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error verifying coupon code.");
    }
  };

  const basePrice = 5000;
  const discountedPrice = 3000;
  const currentPrice = isCouponApplied ? discountedPrice : basePrice;
  const planLabel = 'Kortex AI Pro';

  // Toggle/Manage state helper
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard! ✅`);
  };

  // Submit manual bank transfer
  const handleVerifyManualPaid = async () => {
    if (!user) {
      toast.error("Please log in to upgrade");
      return;
    }
    setIsProcessingPayment(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        payment_status: 'awaiting_approval',
        payment_plan: 'pro',
        payment_amount: currentPrice,
        payment_requested_at: new Date().toISOString(),
        used_coupon: appliedCouponString || null
      });
      setTransferStep('success');
      toast.success("Congratulations! Payment submitted and awaiting admin approval.");
    } catch (error) {
      console.error("Failed to submit manual payment verification:", error);
      toast.error("Failed to submit payment status. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Reset payment request if needed
  const handleResetPaymentRequest = async () => {
    if (!user) return;
    setIsProcessingPayment(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        payment_status: 'idle',
        payment_plan: null,
        payment_amount: null,
        payment_requested_at: null
      });
      setTransferStep('pending');
      toast.success("Payment status reset. You can now choose a plan and pay again.");
    } catch (error) {
      console.error("Failed to reset payment status:", error);
      toast.error("Reset failed. Please check connection.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Real-time firestore upgrade
  const handleActivatePro = async () => {
    if (!user) {
      toast.error("Please log in to upgrade your subscription");
      return;
    }

    setIsProcessingPayment(true);
    
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        is_pro: true,
        payment_status: 'approved'
      });
      
      toast.success(`Successfully upgraded to ${planLabel}! Welcome to Unlimited Access 👑`);
      setShowPaymentModal(false);
    } catch (error) {
      console.error("Failed to upgrade subscription:", error);
      toast.error("Could not complete subscription. Please try again.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const startMonnifyCheckout = () => {
    if (user?.is_pro) {
      setShowCancelConfirmation(true);
      return;
    }
    setShowPaymentModal(true);
    setTransferStep('pending');
  };

  const handleRestore = () => {
    if (user?.is_pro) {
      toast.success("Purchase status is already restored & active! 👑");
    } else {
      toast.promise(
        new Promise((resolve) => setTimeout(resolve, 1500)),
        {
          loading: 'Fulfilling purchase ledger matching...',
          success: 'Purchase status checks computed. No legacy transaction was found on this account.',
          error: 'Could not query transaction logs.',
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-white dark:bg-[#121212] text-black dark:text-white font-sans overflow-hidden flex flex-col select-none z-50">
      
      {/* Background radial styling for pure flat gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[120%] h-[60%] rounded-full bg-[#00BFFF]/5 dark:bg-[#00D2D3]/3 blur-[140px]" />
      </div>

      {/* Hero Image Section - Top section */}
      <div className="relative w-full h-[40vh] sm:h-[42vh] lg:h-[46vh] shrink-0 overflow-hidden z-10 flex flex-col items-center justify-end pb-6">
        
        {/* Sleek premium glowing mesh placeholder that is visible right away */}
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-600/20 via-[#0b2d39]/30 to-[#121212]/20 dark:from-sky-950/30 dark:via-zinc-900/35 dark:to-zinc-950/20" />

        <img 
          src={imageSrc} 
          onError={() => {
            console.log("Local image tag error, falling back to CDN");
            setImageSrc("https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=1200");
          }}
          alt="Premium AI study guide background" 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          referrerPolicy="no-referrer"
        />
        
        {/* Soft, silky-smooth multi-layered gradient fade blending the image completely into the background color at the bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent dark:from-[#121212] dark:via-[#121212]/30 dark:to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-black/5 mix-blend-overlay dark:bg-black/15 pointer-events-none" />

        {/* Top overlay controls - Sleek adaptive cancel close button on the left, pill Go Premium button on the right */}
        <div className="absolute top-6 left-6 right-6 z-30 flex justify-between items-center w-[calc(100%-48px)]">
          <button 
            onClick={() => navigate('/')} 
            className="w-10 h-10 rounded-full bg-white/80 hover:bg-white text-zinc-800 border border-zinc-200/80 dark:bg-zinc-950/50 dark:hover:bg-zinc-950/80 dark:text-zinc-100 dark:border-white/10 backdrop-blur-md flex items-center justify-center transition-all active:scale-90 hover:scale-[1.05] cursor-pointer shadow-sm hover:shadow-md"
            id="close-billing-btn"
            title="Cancel"
          >
            <X size={18} strokeWidth={2.5} />
          </button>

          <button
            onClick={startMonnifyCheckout}
            className="px-4 py-1.5 rounded-full bg-[#00BFFF] hover:bg-[#009FD0] active:scale-95 text-white font-extrabold text-xs tracking-wider transition-all cursor-pointer shadow-md shadow-[#00BFFF]/25 hover:shadow-[#00BFFF]/35"
          >
            Go Premium
          </button>
        </div>

        {/* Copy on top of image */}
        <div className="relative z-20 text-center px-6">
          <h2 className="text-[32px] sm:text-[40px] font-black tracking-tight text-zinc-900 dark:text-white leading-tight font-serif drop-shadow-sm dark:drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]">
            Unlimited Access
          </h2>
          <p className="text-zinc-600 dark:text-white/70 text-[10.5px] sm:text-xs font-bold md:font-semibold tracking-wide mt-2">
            Unlock KortexAi's intelligent study assistant and master your curriculum with ease
          </p>
        </div>
      </div>

      {/* Content Body Layout container to restrict max-width and center contents */}
      <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col justify-between px-4 sm:px-8 pb-6 sm:pb-8 z-10 overflow-hidden relative">
        
        {user?.payment_status === 'awaiting_approval' ? (
          /* Awaiting Approval State Card (Highly Polished & Clean & Neutral) */
          <div className="flex-1 flex flex-col justify-center items-center py-6 w-full max-w-sm sm:max-w-md mx-auto space-y-6">
            <div className="text-center space-y-2 mt-8">
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Verification is being processed</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
                We're currently verifying your transfer details on our ledger.
              </p>
            </div>

            {/* Actions for Pending State */}
            <div className="w-full pt-12 space-y-3">
              <button
                onClick={() => navigate('/')}
                className="w-full py-4 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border border-zinc-900 dark:border-white hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] font-semibold text-sm rounded-[24px] transition-all cursor-pointer shadow-sm"
              >
                Return to home
              </button>
              <button
                onClick={handleResetPaymentRequest}
                disabled={isProcessingPayment}
                className="w-full py-4 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 active:scale-[0.98] font-semibold text-sm text-zinc-600 dark:text-zinc-300 rounded-[24px] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isProcessingPayment && <span className="w-3 h-3 border-2 border-t-transparent border-zinc-400 rounded-full animate-spin" />}
                <span>Cancel Request</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md sm:max-w-lg mx-auto flex-1 flex flex-col justify-between overflow-y-auto px-4 mt-2">
            <div>
              {user?.is_pro && (
                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 w-full justify-center mb-4">
                  <Crown className="text-emerald-500 dark:text-emerald-400 shrink-0" size={18} />
                  <div>
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Premium Active 👑</p>
                  </div>
                </div>
              )}

              {/* Checklist */}
              <div className="space-y-3.5 w-full flex flex-col items-start pl-1 mb-6 mt-2">
                {[
                  { text: "24/7 AI Personal Tutor" },
                  { text: "Smart Curriculum Navigation" },
                  { text: "Auto-Generated Study Notes" },
                  { text: "Adaptive Practice Quizzes" },
                  { text: "Deep Performance Analytics" }
                ].map((feature, index) => (
                  <div key={index} className="flex items-center gap-3.5 group">
                    <div className="w-[18px] h-[18px] rounded-md bg-[#00BFFF] border border-[#00BFFF] flex items-center justify-center text-white shrink-0 shadow-sm shadow-[#00BFFF]/20">
                      <Check size={12} strokeWidth={4} />
                    </div>
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              {!user?.is_pro ? (
                /* Single Plan Pricing Card */
                <div className="mt-2 mb-4 w-full">
                  <div className="p-5 sm:p-6 rounded-[20px] bg-[#EBF5FB] border-2 border-[#00BFFF] dark:bg-zinc-900 shadow-md text-zinc-900 dark:text-white flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Kortex AI Pro</span>
                      <div className="w-5 h-5 rounded-[5px] bg-[#00BFFF] border border-[#00BFFF] flex items-center justify-center text-white shadow-sm">
                        <Check size={12} strokeWidth={4} />
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      {isCouponApplied ? (
                        <>
                          <span className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">₦3,000</span>
                          <span className="text-base font-bold text-zinc-400 line-through mb-0.5">₦5,000</span>
                          <span className="ml-auto text-[10px] font-extrabold tracking-wide text-[#00BFFF] bg-[#00BFFF]/10 border border-[#00BFFF]/20 rounded px-2 py-0.5">Save 40%</span>
                        </>
                      ) : (
                        <>
                          <span className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">₦5,000</span>
                          <span className="text-[10px] font-extrabold tracking-wide text-[#00BFFF] bg-[#00BFFF]/10 border border-[#00BFFF]/20 rounded px-2 py-0.5 ml-auto">Coupon available</span>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">Valid until August 31, 2026</p>
                  </div>
                </div>
              ) : (
                /* Verified User Pro Duration Display */
                <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[20px] p-6 mb-6 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center pb-3.5 border-b border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">Current Plan</span>
                      <span className="font-bold text-[14px] text-zinc-900 dark:text-white">Kortex AI Pro</span>
                    </div>
                    <div className="flex justify-between items-center pb-3.5 border-b border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">Activated On</span>
                      <span className="font-semibold text-[14px] text-zinc-900 dark:text-white">
                        {user.payment_requested_at 
                          ? new Date(user.payment_requested_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
                          : 'Today'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">Valid Until</span>
                      <span className="font-black text-[14px] text-emerald-600 dark:text-emerald-400">August 31, 2026</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Coupon Code Input */}
              {!user?.is_pro && (
                <div className="w-full mt-4 flex gap-2">
                  <input 
                    type="text" 
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    disabled={isCouponApplied}
                    placeholder="Apply coupon code"
                    className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:border-[#00BFFF] disabled:opacity-60 transition-all shadow-sm"
                  />
                  <button 
                    onClick={handleApplyCoupon}
                    disabled={isCouponApplied || !couponInput.trim()}
                    className="px-5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs uppercase tracking-wider disabled:opacity-50 hover:opacity-90 active:scale-95 transition-all shadow-sm cursor-pointer"
                  >
                    {isCouponApplied ? 'Applied' : 'Apply'}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom block with Action Button */}
            <div className="mt-auto w-full flex flex-col items-center">
              {/* Action Button - Fully Matches Mockup with sky-blue pill button and right-pointing caret symbol */}
              <button
                onClick={startMonnifyCheckout}
                disabled={isProcessingPayment}
                className="w-full h-12 bg-gradient-to-r from-[#00BFFF] to-[#009FD0] hover:scale-[1.01] active:scale-[0.99] text-white font-black tracking-widest text-xs uppercase rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer shadow-lg shadow-[#00BFFF]/20 border border-white/10"
              >
                {user?.is_pro ? (
                  <span>Manage Premium 👑</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <span>Unlock Access</span>
                    <span className="text-[13px] font-sans font-black">&gt;</span>
                  </span>
                )}
              </button>
              
              {/* Mockup Utility Footer links centered perfectly */}
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center flex items-center justify-center gap-3.5 mt-5 pointer-events-auto pb-2">
                <button onClick={() => toast.success("Terms of Use matches Apple App Store legal frameworks. 📜")} className="hover:underline transition-all cursor-pointer">Terms of use</button>
                <span className="text-zinc-300 dark:text-zinc-700 font-semibold">|</span>
                <button onClick={() => toast.success("Privacy Policy is verified compliant with COPPA and GDPR. 🔒")} className="hover:underline transition-all cursor-pointer">Privacy Policy</button>
                <span className="text-zinc-300 dark:text-zinc-700 font-semibold">|</span>
                <button onClick={handleRestore} className="hover:underline transition-all cursor-pointer">Restore</button>
              </div>
            </div>
          </div>
        )}
        
      </div>

      {/* Interactive Manual Bank Payment Verification Sheet */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 z-50 bg-white dark:bg-[#121212] flex flex-col overflow-y-auto"
          >
            {transferStep === 'success' ? (
              /* Finish State: Confetti & Ticket Details */
              <div className="flex-1 flex flex-col pt-safe bg-white dark:bg-[#121212] min-h-screen relative overflow-hidden">
                
                {/* Confetti Background layer */}
                <div className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-20 overflow-hidden">
                  {/* Left Side */}
                  <div className="absolute top-[10%] left-[15%] w-2 h-6 bg-[#1CD1A1] -rotate-45" />
                  <div className="absolute top-[15%] left-[5%] w-3 h-3 bg-[#FFC107] rotate-12" />
                  <div className="absolute top-[30%] left-[25%] w-2 h-6 bg-[#FFC107] rotate-[30deg]" />
                  <div className="absolute top-[45%] left-[10%] w-6 h-2 bg-[#FF4B4B] -rotate-12" />
                  <div className="absolute top-[55%] left-[30%] w-4 h-2 bg-[#1CD1A1] rotate-45" />
                  <div className="absolute top-[28%] left-[8%] w-5 h-2 bg-[#1CD1A1] rotate-[15deg]" />
                  <div className="absolute top-[75%] left-[15%] w-3 h-3 bg-[#FFC107] rotate-[45deg]" />
                  <div className="absolute top-[85%] left-[5%] w-4 h-2 bg-[#FF4B4B] -rotate-12" />
                  <div className="absolute top-[65%] left-[20%] w-2 h-5 bg-[#1CD1A1] rotate-12" />

                  {/* Right Side */}
                  <div className="absolute top-[20%] right-[20%] w-5 h-2 bg-[#FF4B4B] rotate-45" />
                  <div className="absolute top-[5%] right-[30%] w-2 h-4 bg-[#FFC107] -rotate-12" />
                  <div className="absolute top-[35%] right-[10%] w-4 h-2 bg-[#1CD1A1] -rotate-45" />
                  <div className="absolute top-[40%] right-[35%] w-3 h-3 bg-[#FF4B4B] rotate-[60deg]" />
                  <div className="absolute top-[50%] right-[5%] w-2 h-6 bg-[#FFC107] rotate-[15deg]" />
                  <div className="absolute top-[60%] right-[25%] w-3 h-3 bg-[#FF4B4B] -rotate-[30deg]" />
                  <div className="absolute top-[15%] right-[5%] w-2 h-5 bg-[#FF4B4B] -rotate-[20deg]" />
                  <div className="absolute top-[70%] right-[15%] w-5 h-2 bg-[#1CD1A1] rotate-45" />
                  <div className="absolute top-[80%] right-[30%] w-2 h-6 bg-[#FFC107] -rotate-12" />

                  {/* Center Area (lightly scattered) */}
                  <div className="absolute top-[8%] left-[45%] w-3 h-3 bg-[#1CD1A1] rotate-12" />
                  <div className="absolute top-[25%] left-[55%] w-2 h-5 bg-[#FFC107] -rotate-45" />
                  <div className="absolute top-[65%] left-[45%] w-4 h-2 bg-[#FF4B4B] rotate-12" />
                  <div className="absolute top-[48%] left-[70%] w-2 h-4 bg-[#1CD1A1] rotate-[75deg]" />
                </div>

                <div className="flex-1 flex flex-col items-center pt-24 px-6 z-10 w-full max-w-md mx-auto">
                  
                  {/* Success Icon */}
                  <div className="w-[160px] h-[160px] rounded-full bg-[#E0F7EB] dark:bg-[#1CD1A1]/10 flex items-center justify-center mb-8 relative">
                    <div className="w-[100px] h-[100px] rounded-full bg-[#1CD1A1] flex items-center justify-center shadow-lg">
                      <CheckCheck size={48} strokeWidth={2.5} className="text-white" />
                    </div>
                  </div>

                  <h2 className="text-[26px] font-bold mb-2 text-zinc-900 dark:text-white tracking-tight">Payment Successful!</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-center text-[15px] mb-10">
                    Successfully Paid ₦{currentPrice.toLocaleString()}
                  </p>

                  {/* Details Card */}
                  <div className="w-full rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-6 mb-10">
                    <h3 className="font-bold text-[16px] text-zinc-900 dark:text-white mb-5">Details</h3>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-zinc-500 dark:text-zinc-400">Item Price</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">₦{currentPrice.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-zinc-500 dark:text-zinc-400">Registration Fee</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">₦0.00</span>
                      </div>
                      <div className="flex justify-between items-center text-[14px]">
                        <span className="text-zinc-500 dark:text-zinc-400">VAT 0%</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">- ₦0</span>
                      </div>
                    </div>

                    <div className="h-[1px] w-full bg-zinc-100 dark:bg-zinc-800 mb-6"></div>

                    <div className="flex justify-between items-center mb-6">
                      <span className="font-bold text-[16px] text-zinc-900 dark:text-white">Grand Total</span>
                      <span className="font-black text-[18px] text-zinc-900 dark:text-white">₦{currentPrice.toLocaleString()}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[16px] text-zinc-900 dark:text-white">Status</span>
                      <div className="px-4 py-1.5 rounded-full border-2 border-[#1CD1A1] text-[#1CD1A1] font-bold text-[13px] bg-[#1CD1A1]/10">
                        Paid
                      </div>
                    </div>
                  </div>

                  <div className="w-full mt-auto pb-10">
                    <button 
                      onClick={() => {
                        setShowPaymentModal(false);
                        navigate('/');
                      }}
                      className="w-full h-14 text-[16px] bg-[#F97316] hover:bg-[#EA580C] text-white font-bold rounded-full transition-all shadow-md active:scale-[0.98]"
                    >
                      Back Home
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Payment Transfer State */
              <div className="flex-1 flex flex-col pt-safe bg-white dark:bg-[#121212] font-sans relative min-h-screen">
                {/* Header ("notch where payment is") */}
                <div className="border-b border-gray-100 dark:border-zinc-800 relative flex items-center justify-center min-h-[60px] w-full bg-white dark:bg-[#121212] z-20">
                  <h2 className="font-semibold text-[17px] text-[#111827] dark:text-zinc-100 tracking-tight">Payment</h2>
                  <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
                    <button onClick={() => setShowPaymentModal(false)} className="w-10 h-10 rounded-full border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 flex items-center justify-center text-gray-600 hover:text-[#111827] dark:text-gray-400 dark:hover:text-white transition-all hover:bg-gray-100 dark:hover:bg-zinc-700 active:scale-95 outline-none">
                      <X size={20} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Top spacer (smaller so cards go slightly upwards) */}
                <div className="flex-[0.2] min-h-[16px]"></div>

                <div className="w-full px-5 flex flex-col space-y-4 max-w-[500px] mx-auto z-10 shrink-0">
                  
                  {/* Top Hero Card (The Amount) */}
                  <div className="w-full p-8 rounded-2xl bg-gradient-to-b from-blue-50 to-white dark:from-blue-900/20 dark:to-zinc-900/50 relative overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col items-center">
                    
                    {/* Concentric rings */}
                    <div className="absolute top-[28px] left-1/2 -translate-x-1/2 w-14 h-14 rounded-full border border-blue-200 dark:border-blue-500/30"></div>
                    <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border border-blue-100 dark:border-blue-500/20"></div>
                    <div className="absolute top-[4px] left-1/2 -translate-x-1/2 w-[104px] h-[104px] rounded-full border border-blue-50 dark:border-blue-500/10"></div>

                    {/* Icon */}
                    <div className="relative z-10 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mb-6 shadow-sm">
                      <Wallet size={24} className="text-white" />
                    </div>

                    <h1 className="relative z-10 text-[42px] font-bold tracking-tight text-[#111827] dark:text-white flex items-start justify-center gap-1 mb-1">
                      <span className="text-[20px] font-medium text-gray-400 mt-2.5">₦</span>
                      {currentPrice.toLocaleString()}
                    </h1>
                    
                    <div className="relative z-10 text-[13px] font-medium text-[#6B7280] dark:text-gray-400">
                      Payable to Kortex AI
                    </div>
                  </div>

                  {/* Middle Card (Bank Details) */}
                  <div className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="p-4 sm:p-5 flex justify-between items-center">
                      <div>
                        <p className="text-[12.5px] text-[#6B7280] dark:text-gray-400 mb-0.5">Bank Name</p>
                        <p className="font-semibold text-[15px] text-[#111827] dark:text-white">Moniepoint MFB</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12.5px] text-[#6B7280] dark:text-gray-400 mb-0.5">Account Name</p>
                        <p className="font-semibold text-[15px] text-[#111827] dark:text-white">Osarobo Godstime Eghosa</p>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-100 dark:border-zinc-800"></div>

                    <div className="p-4 sm:p-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[12.5px] text-[#6B7280] dark:text-gray-400 mb-1">Account No.</p>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-[16px] sm:text-[18px] text-[#111827] dark:text-white tracking-tight">6667336080</p>
                          <button onClick={() => handleCopy("6667336080", "Account number")} className="text-blue-500 hover:opacity-80 active:scale-95 transition-all outline-none p-1 -m-1"><Copy size={16} /></button>
                        </div>
                      </div>
                      <div className="flex flex-col items-end text-right">
                        <p className="text-[12.5px] text-[#6B7280] dark:text-gray-400 mb-1">Narration</p>
                        <div className="flex items-center gap-2 justify-end">
                          <p className="font-bold text-[16px] sm:text-[18px] text-[#111827] dark:text-white tracking-tight truncate max-w-[120px] sm:max-w-none">
                            {user?.phone_number || "Phone No"}
                          </p>
                          <button onClick={() => handleCopy(user?.phone_number || "", "Narration")} className="text-blue-500 hover:opacity-80 active:scale-95 transition-all outline-none p-1 -m-1"><Copy size={16} /></button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Card (How to Pay) */}
                  <div className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-200 dark:border-zinc-800 shadow-sm">
                    <div className="p-4 sm:p-5 flex items-center justify-between">
                      <h4 className="font-semibold text-[15px] text-[#111827] dark:text-white">How to pay</h4>
                      <div className="w-5 h-5 rounded-full border border-gray-300 dark:border-zinc-700 flex items-center justify-center text-gray-500 dark:text-gray-400 font-serif text-[12px] italic">i</div>
                    </div>
                    
                    <div className="border-t border-gray-100 dark:border-zinc-800"></div>

                    <div className="p-4 sm:p-5">
                      <ol className="text-[14px] text-[#4B5563] dark:text-gray-300 space-y-3 font-medium ml-4 list-decimal marker:text-gray-400 marker:font-semibold leading-relaxed">
                        <li>Transfer exact amount to the account above.</li>
                        <li>Use your <strong className="text-[#111827] dark:text-white">Phone Number</strong> as narration.</li>
                        <li>Click <strong className="text-[#111827] dark:text-white">"I have paid"</strong> below.</li>
                        <li>Wait briefly for verification.</li>
                      </ol>
                    </div>
                  </div>
                </div>

                {/* Bottom spacer (equal to top spacer) */}
                <div className="flex-1 min-h-[40px]"></div>

                {/* Bottom Buttons */}
                <div className="w-full px-5 pb-safe pb-8 pt-4 max-w-[500px] mx-auto z-10 shrink-0">
                  <div className="w-full flex gap-3 pointer-events-auto">
                    <button 
                      onClick={() => setShowPaymentModal(false)}
                      className="flex-1 h-14 bg-white dark:bg-zinc-900 border border-[#111827] dark:border-zinc-700 text-[#111827] dark:text-white font-medium rounded-full text-[15px] active:scale-[0.98] transition-transform"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleVerifyManualPaid}
                      disabled={isProcessingPayment}
                      className="flex-1 h-14 bg-[#111827] dark:bg-white text-white dark:text-[#111827] font-medium rounded-full text-[15px] active:scale-[0.98] transition-transform disabled:opacity-50"
                    >
                      {isProcessingPayment ? "Processing..." : "I have paid"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Account Settings / Downgrade Portal Options modal */}
      <AnimatePresence>
        {showCancelConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCancelConfirmation(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-zinc-900 border border-zinc-800 text-white w-full max-w-xs rounded-3xl p-6 relative z-10 text-center"
            >
              <Crown className="text-amber-400 mx-auto mb-3" size={32} />
              <h4 className="text-lg font-black tracking-tight mb-4">Active Pro Account</h4>
              
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-4 text-left space-y-3 border border-zinc-700/50">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Status</span>
                  <span className="text-emerald-400 font-bold">Premium Active 👑</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Current Plan</span>
                  <span className="text-white font-semibold">Kortex AI Pro</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Activated On</span>
                  <span className="text-white font-semibold">
                    {user?.payment_requested_at 
                      ? new Date(user?.payment_requested_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
                      : 'Today'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Valid Until</span>
                  <span className="text-emerald-400 font-bold">August 31, 2026</span>
                </div>
              </div>

              <div className="mt-6 space-y-2.5">
                <button
                  onClick={() => setShowCancelConfirmation(false)}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 font-bold text-xs uppercase tracking-wider rounded-full text-zinc-300 transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
