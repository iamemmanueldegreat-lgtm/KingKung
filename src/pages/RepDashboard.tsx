import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { 
  ArrowLeft, Copy, Wallet, Users, LayoutDashboard, Menu, X, 
  ChevronRight, BadgeCheck, Clock, CheckCircle2, Banknote, Landmark,
  History as HistoryIcon, UserCircle, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function RepDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'sales' | 'withdrawals' | 'accounts' | 'history'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [accountName, setAccountName] = useState('');
  
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedBankId, setSelectedBankId] = useState('');
  
  const repBankAccounts = user?.rep_bank_accounts || [];
  
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);

  const [myWithdrawals, setMyWithdrawals] = useState<any[]>([]);
  const [loadingMyWithdrawals, setLoadingMyWithdrawals] = useState(false);

  const earnings = user?.rep_earnings || 0;
  const withdrawn = user?.rep_withdrawn || 0;
  const uses = user?.coupon_uses || 0;
  const couponCode = user?.rep_coupon_code || '';
  
  const pendingWithdrawalAmount = myWithdrawals
    .filter(w => w.status === 'pending')
    .reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
  const availableBalance = Math.max(0, earnings - withdrawn - pendingWithdrawalAmount);

  useEffect(() => {
    if (!user || user.is_rep !== true) {
      toast.error('Unauthorized access');
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user?.rep_coupon_code) {
      fetchReferrals();
    }
  }, [user?.rep_coupon_code]);

  useEffect(() => {
    if (user?.id) {
      fetchMyWithdrawals();
    }
  }, [user?.id]);

  const fetchMyWithdrawals = async () => {
    if (!user) return;
    setLoadingMyWithdrawals(true);
    try {
      const wRef = collection(db, 'withdrawal_requests');
      const q = query(wRef, where('user_id', '==', user.id));
      const snapshot = await getDocs(q);
      const reqs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      reqs.sort((a: any, b: any) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
      setMyWithdrawals(reqs);
    } catch (e) {
      console.error("Error fetching my withdrawals:", e);
    } finally {
      setLoadingMyWithdrawals(false);
    }
  };

  const fetchReferrals = async () => {
    if (!user?.rep_coupon_code) return;
    setLoadingReferrals(true);
    try {
      const usersRef = collection(db, 'users');
      // Limit to 50 for performance
      const q = query(usersRef, where('used_coupon', '==', user.rep_coupon_code));
      const snapshot = await getDocs(q);
      const refs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      refs.sort((a: any, b: any) => {
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setReferredUsers(refs);
    } catch (e) {
      console.error("Error fetching referrals:", e);
    } finally {
      setLoadingReferrals(false);
    }
  };

  const handleAddAccount = async () => {
    if (!user) return;
    if (!bankName || !bankAccount) {
      toast.error('Please enter Bank Name and Account Number');
      return;
    }
    setLoading(true);
    try {
      const userRef = doc(db, 'users', user.id);
      const newAccount = {
        id: Date.now().toString(),
        bank_name: bankName.trim(),
        account_number: bankAccount.trim(),
        account_name: accountName.trim(),
      };
      await updateDoc(userRef, { 
        rep_bank_accounts: [...repBankAccounts, newAccount]
      });
      setBankName('');
      setBankAccount('');
      setAccountName('');
      toast.success('Bank details added!');
    } catch (e) {
      toast.error('Failed to add bank details.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!user) return;
    const amountNum = parseFloat(withdrawalAmount);
    
    if (!amountNum || amountNum < 1000) {
      toast.error('Minimum withdrawal is ₦1,000');
      return;
    }
    if (amountNum > availableBalance) {
      toast.error('Insufficient funds');
      return;
    }
    if (!selectedBankId) {
      toast.error('Please select an account');
      return;
    }
    
    const bank = repBankAccounts.find(b => b.id === selectedBankId);
    if (!bank) return;
    
    setLoading(true);
    try {
      // Add withdrawal request
      const withdrawalsRef = collection(db, 'withdrawal_requests');
      await addDoc(withdrawalsRef, {
        user_id: user.id,
        user_name: user.full_name || '',
        user_email: user.email,
        amount: amountNum,
        bank_name: bank.bank_name,
        account_number: bank.account_number,
        account_name: bank.account_name || '',
        status: 'pending',
        requested_at: new Date().toISOString()
      });
      
      // Update withdrawn amount locally or on user (to prevent multiple requests simultaneously maybe)
      // Usually, we'd deduct after admin approval, or set balance. 
      // But let's create request, and wait for admin
      
      toast.success('Withdrawal request placed successfully!');
      setWithdrawalAmount('');
      setSelectedBankId('');
      fetchMyWithdrawals();
    } catch (e) {
      toast.error("Failed to place withdrawal request.");
    } finally {
      setLoading(false);
    }
  };

  if (!user || !user.is_rep) return null;

  const verifiedReferrals = referredUsers.filter(u => u.payment_status === 'approved');
  const pendingReferrals = referredUsers.filter(u => u.payment_status === 'awaiting_approval' || !u.payment_status);

  const SidebarContent = () => (
    <div className="h-full flex flex-col pt-8 pb-4">
      <div className="px-6 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {(user as any).avatar_url || (user as any).photoURL ? (
            <img 
              src={(user as any).avatar_url || (user as any).photoURL} 
              alt={user.full_name || 'User'} 
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
              {user.full_name?.charAt(0) || 'R'}
            </div>
          )}
          <div>
            <h2 className="font-bold text-sm text-zinc-900 dark:text-white truncate max-w-[120px]">{user.full_name}</h2>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Rep Portal</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-2 overflow-y-auto">
        <button
          onClick={() => { setActiveTab('overview'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
            activeTab === 'overview' 
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-[1.02]' 
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <LayoutDashboard size={18} />
          Overview
        </button>
        <button
          onClick={() => { setActiveTab('sales'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
            activeTab === 'sales' 
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-[1.02]' 
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <div className="flex items-center gap-3">
            <Users size={18} />
            Coupon Users
          </div>
          {verifiedReferrals.length > 0 && (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${activeTab === 'sales' ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
              {verifiedReferrals.length}
            </span>
          )}
        </button>
        <button
          onClick={() => { setActiveTab('withdrawals'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
            activeTab === 'withdrawals' 
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-[1.02]' 
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Wallet size={18} />
          Withdrawal Center
        </button>
        <button
          onClick={() => { setActiveTab('accounts'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
            activeTab === 'accounts' 
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-[1.02]' 
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Landmark size={18} />
          Accounts
        </button>
        <button
          onClick={() => { setActiveTab('history'); setIsSidebarOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
            activeTab === 'history' 
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-md scale-[1.02]' 
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <HistoryIcon size={18} />
          Earnings History
        </button>
      </div>

    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFE] dark:bg-[#0A0A0A] flex text-zinc-900 dark:text-white font-sans overflow-hidden">
      
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-72 h-screen border-r border-zinc-200 dark:border-zinc-800 bg-[#F4F5F7] dark:bg-[#121212]">
        <SidebarContent />
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#F4F5F7] dark:bg-[#121212] z-50 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 h-screen overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="w-full px-4 sm:px-8 py-6 sm:py-10 pb-32">
          
          {/* Header Mobile / Title */}
          <div className="flex items-start justify-between gap-4 mb-10">
            <div className="flex items-start gap-3 sm:gap-4">
              <button 
                onClick={() => {
                  if (activeTab === 'overview') {
                    navigate('/');
                  } else {
                    setActiveTab('overview');
                  }
                }}
                className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-sm border border-zinc-200 dark:border-zinc-800 shrink-0 mt-1"
              >
                <ArrowLeft size={18} className="text-zinc-700 dark:text-zinc-300" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white leading-tight">
                  {activeTab === 'overview' && 'Dashboard Overview'}
                  {activeTab === 'sales' && 'Coupon Users'}
                  {activeTab === 'withdrawals' && 'Withdrawals'}
                  {activeTab === 'accounts' && 'Bank Accounts'}
                  {activeTab === 'history' && 'Earnings History'}
                </h1>
                <p className="text-xs sm:text-sm font-medium text-zinc-500 mt-1">
                  {activeTab === 'overview' && 'A quick glance at your performance & earnings.'}
                  {activeTab === 'sales' && 'Track everyone who upgraded using your code.'}
                  {activeTab === 'withdrawals' && 'Manage your money and request payouts.'}
                  {activeTab === 'accounts' && 'Manage your saved bank accounts for withdrawal.'}
                  {activeTab === 'history' && 'History of users verified and your earnings.'}
                </p>
              </div>
            </div>

            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 lg:hidden rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white shadow-sm shrink-0"
            >
              <Menu size={20} />
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div 
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Coupon Code Banner */}
                <div className="bg-black text-white rounded-2xl border-[2px] border-dashed border-zinc-600 overflow-hidden w-full shadow-md">
                  <div className="p-4 sm:p-5 flex items-center justify-between">
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <p className="text-zinc-400 font-medium text-xs sm:text-sm mb-1 uppercase tracking-wider">Your Coupon Code</p>
                      <h2 className="text-3xl sm:text-4xl font-black tracking-widest leading-none drop-shadow-sm">{couponCode || 'NOT SET'}</h2>
                    </div>
                    {couponCode && (
                      <div className="flex items-center shrink-0">
                        <div className="w-[1.5px] h-12 bg-zinc-700 mx-4 sm:mx-6 shrink-0"></div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(couponCode);
                            toast.success('Coupon code copied!');
                          }}
                          className="flex flex-col items-center justify-center text-zinc-400 hover:text-white active:scale-95 transition-all text-sm font-semibold pr-2 sm:pr-4"
                        >
                          <span>Copy</span>
                          <span>Code</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-[#1A1A1A] p-5 sm:p-6 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
                      <LayoutDashboard size={20} />
                    </div>
                    <p className="text-[11px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1">Total Verified</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">{uses}</h2>
                  </div>

                  <div className="bg-white dark:bg-[#1A1A1A] p-5 sm:p-6 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
                      <Banknote size={20} />
                    </div>
                    <p className="text-[11px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1">Total Earned</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">₦{earnings.toLocaleString()}</h2>
                  </div>

                  <div className="bg-white dark:bg-[#1A1A1A] p-5 sm:p-6 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                    <div className="w-10 h-10 rounded-full bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4">
                      <Wallet size={20} />
                    </div>
                    <p className="text-[11px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1">Available</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">₦{availableBalance.toLocaleString()}</h2>
                  </div>

                  <div className="bg-white dark:bg-[#1A1A1A] p-5 sm:p-6 rounded-[24px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                    <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
                      <Landmark size={20} />
                    </div>
                    <p className="text-[11px] text-zinc-500 font-extrabold uppercase tracking-widest mb-1">Withdrawn</p>
                    <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white">₦{withdrawn.toLocaleString()}</h2>
                  </div>
                </div>

                {/* Recent Activity Mini */}
                <div className="bg-white dark:bg-[#1A1A1A] rounded-[24px] border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="font-black text-lg">Recent Verified Users</h3>
                    <button 
                      onClick={() => setActiveTab('sales')}
                      className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      View All <ChevronRight size={16} />
                    </button>
                  </div>
                  
                  {loadingReferrals ? (
                    <div className="p-8 text-center text-zinc-500 animate-pulse font-bold">Loading activity...</div>
                  ) : verifiedReferrals.length === 0 ? (
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800">
                      <p className="text-zinc-500 font-medium">No verified uses yet.</p>
                      <p className="text-xs text-zinc-400 mt-1">Distribute your code to get started!</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {verifiedReferrals.slice(0, 5).map((u, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/50">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                              <BadgeCheck size={18} />
                            </div>
                            <div>
                              <p className="font-bold text-sm text-zinc-900 dark:text-white">{u.full_name || 'Anonymous'}</p>
                              <p className="text-xs text-zinc-500 font-medium">{u.email}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-emerald-600 dark:text-emerald-400">+₦250</p>
                            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Earned</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'sales' && (
              <motion.div 
                key="sales"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="bg-white dark:bg-[#1A1A1A] rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm overflow-hidden">
                  <div className="p-6 sm:p-8 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div>
                      <h2 className="text-xl font-black">All Coupon Users</h2>
                      <p className="text-xs text-zinc-500 font-medium mt-1">Users who inputted your code during upgrade.</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600">
                      <Users size={24} />
                    </div>
                  </div>

                  <div className="p-4 sm:p-6 lg:p-8">
                    {loadingReferrals ? (
                      <div className="p-8 text-center text-zinc-500 animate-pulse font-bold">Loading...</div>
                    ) : referredUsers.length === 0 ? (
                      <div className="text-center p-12">
                        <Users size={40} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">No uses yet</h3>
                        <p className="text-zinc-500 text-sm mt-2 max-w-sm mx-auto font-medium">When users upgrade with your unique code, they will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {referredUsers.map((u, i) => {
                          const isApproved = u.payment_status === 'approved';
                          return (
                            <div key={i} className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border ${
                              isApproved 
                                ? 'bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/10' 
                                : 'bg-zinc-50 dark:bg-zinc-900/50 border-zinc-100 dark:border-zinc-800'
                            } transition-colors w-full`}>
                              <div className="flex items-center gap-3 sm:gap-4 flex-1 truncate">
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${
                                  isApproved 
                                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                }`}>
                                  {isApproved ? <CheckCircle2 size={20} className="sm:size-6" /> : <Clock size={20} className="sm:size-6" />}
                                </div>
                                <div className="truncate">
                                  <h3 className="font-bold text-sm sm:text-[15px] text-zinc-900 dark:text-white truncate">{u.full_name || 'Anonymous User'}</h3>
                                  <p className="text-[11px] sm:text-xs text-zinc-500 font-medium truncate">{u.email}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0 ml-4">
                                <p className="font-extrabold text-sm sm:text-[15px]">{isApproved ? '+₦250' : 'Pending'}</p>
                                <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider leading-none mt-0.5 ${
                                  isApproved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'
                                }`}>
                                  {isApproved ? 'Verified' : 'Wait'}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'withdrawals' && (
              <motion.div 
                key="withdrawals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8"
              >
                {/* Left Col - Action & Bank */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Balance Card */}
                  <div className="bg-white dark:bg-black rounded-[28px] p-8 text-zinc-900 dark:text-white border border-zinc-100 dark:border-zinc-800 shadow-xl relative overflow-hidden">
                    <div className="absolute -right-10 -bottom-10 grid gap-4 grid-cols-3 opacity-5 pointer-events-none rotate-12">
                      {[...Array(9)].map((_, i) => (
                        <div key={i} className="w-12 h-12 border border-zinc-900 dark:border-white rounded-xl" />
                      ))}
                    </div>
                    <div className="relative z-10">
                      <p className="text-zinc-500 font-bold text-xs uppercase tracking-widest mb-1">Available to Withdraw</p>
                      <h2 className="text-4xl font-black mb-6">₦{availableBalance.toLocaleString()}</h2>

                      <div className="space-y-4 mb-6">
                          <div>
                              <label className="block text-xs font-black text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Withdrawal Amount (₦)</label>
                              <input 
                                  type="number" 
                                  value={withdrawalAmount}
                                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                                  className="w-full bg-[#F4F5F7] dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 text-sm font-bold text-zinc-900 dark:text-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 outline-none transition-all placeholder-zinc-400"
                                  placeholder="Enter amount..."
                              />
                          </div>
                          
                          <div>
                              <label className="block text-xs font-black text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">Select Bank Account</label>
                              {repBankAccounts.length === 0 ? (
                                  <button 
                                      onClick={() => setActiveTab('accounts')}
                                      className="w-full text-left bg-[#F4F5F7] dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 text-sm text-zinc-500 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                                  >
                                      + Add a Bank Account first
                                  </button>
                              ) : (
                                  <select 
                                      value={selectedBankId}
                                      onChange={(e) => setSelectedBankId(e.target.value)}
                                      className="w-full bg-[#F4F5F7] dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-3 text-sm font-bold text-zinc-900 dark:text-white focus:border-zinc-500 focus:ring-1 focus:ring-zinc-400 outline-none transition-all appearance-none"
                                  >
                                      <option value="">Choose an account...</option>
                                      {repBankAccounts.map((b) => (
                                          <option key={b.id} value={b.id}>
                                              {b.bank_name} - {b.account_number}
                                          </option>
                                      ))}
                                  </select>
                              )}
                          </div>
                      </div>

                      <button 
                        onClick={handleWithdraw}
                        disabled={availableBalance < 1000 || !withdrawalAmount || !selectedBankId || loading}
                        className="w-full py-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-black font-black text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Processing...' : 'Request Withdrawal'}
                      </button>
                      {availableBalance < 1000 && (
                        <p className="text-[10px] sm:text-xs text-center text-zinc-400 font-bold mt-3">Minimum withdrawal is ₦1,000</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Col - Transaction History */}
                {/* Right Col - Withdrawal History */}
                <div className="lg:col-span-7 bg-white dark:bg-[#1A1A1A] rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col h-[500px] lg:h-auto overflow-hidden">
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <h3 className="font-black text-lg flex items-center gap-2">
                       <HistoryIcon size={20} className="text-zinc-400" /> Withdrawal History
                    </h3>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                    {loadingMyWithdrawals ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400">Loading...</div>
                    ) : myWithdrawals.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-3">
                        <Wallet size={40} className="opacity-20" />
                        <p className="font-bold">No withdrawals yet</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {myWithdrawals.map((w, i) => (
                          <div key={i} className="flex items-center justify-between py-3 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                            <div>
                              <p className="font-bold text-[14px]">Withdrawal to {w.bank_name}</p>
                              <p className="text-xs text-zinc-500 font-medium">Acc: {w.account_number}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-[15px]">₦{w.amount?.toLocaleString()}</p>
                              <span className={`text-[10px] uppercase tracking-widest font-black inline-block mt-0.5 ${
                                w.status === 'approved' ? 'text-emerald-500' :
                                w.status === 'rejected' ? 'text-rose-500' :
                                'text-amber-500'
                              }`}>
                                {w.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: Accounts */}
            {activeTab === 'accounts' && (
              <motion.div
                key="accounts"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid lg:grid-cols-12 gap-6 sm:gap-8 w-full"
              >
                <div className="lg:col-span-5 space-y-6">
                  {/* Add Bank Form */}
                  <div className="bg-white dark:bg-[#1A1A1A] rounded-[28px] p-6 sm:p-8 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <h3 className="font-black text-lg mb-6 flex items-center gap-2">
                       <Landmark size={20} className="text-zinc-400" /> Add New Account
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-black text-zinc-500 mb-2 uppercase tracking-wider">Bank Name</label>
                        <input 
                          type="text" 
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. OPay, Moniepoint"
                          className="w-full bg-[#F4F5F7] dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-zinc-500 mb-2 uppercase tracking-wider">Account Number</label>
                        <input 
                          type="text" 
                          value={bankAccount}
                          onChange={(e) => setBankAccount(e.target.value)}
                          placeholder="10 digit account number"
                          className="w-full bg-[#F4F5F7] dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-zinc-500 mb-2 uppercase tracking-wider">Account Name</label>
                        <input 
                          type="text" 
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          placeholder="e.g. John Doe"
                          className="w-full bg-[#F4F5F7] dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-bold text-zinc-900 dark:text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <button 
                        onClick={handleAddAccount}
                        disabled={loading || !bankName || !bankAccount}
                        className="w-full mt-2 py-4 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-black text-[15px] hover:bg-zinc-800 dark:hover:bg-zinc-100 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Saving...' : 'Save Account'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 bg-white dark:bg-[#1A1A1A] rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col h-[500px] lg:h-auto overflow-hidden">
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <h3 className="font-black text-lg flex items-center gap-2">
                       <Landmark size={20} className="text-zinc-400" /> Saved Accounts
                    </h3>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1">
                    {repBankAccounts.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-3">
                        <Landmark size={40} className="opacity-20" />
                        <p className="font-bold">No accounts saved</p>
                        <p className="text-xs">Add an account to request withdrawals.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {repBankAccounts.map((b) => (
                          <div key={b.id} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/10 border border-zinc-100 dark:border-zinc-800">
                            <div>
                              <p className="font-bold text-[15px]">{b.bank_name}</p>
                              <p className="text-sm text-zinc-500 font-medium font-mono">{b.account_number}</p>
                              {b.account_name && <p className="text-xs text-zinc-400 mt-1">{b.account_name}</p>}
                            </div>
                            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 size={18} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: History */}
            {activeTab === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full"
              >
                <div className="bg-white dark:bg-[#1A1A1A] rounded-[28px] border border-zinc-100 dark:border-zinc-800 shadow-sm flex flex-col">
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <h3 className="font-black text-lg flex items-center gap-2">
                       <HistoryIcon size={20} className="text-zinc-400" /> Earnings History
                    </h3>
                    <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Earned: </span>
                      <span className="font-black text-zinc-900 dark:text-white">₦{earnings.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="p-6 flex-1">
                    {loadingReferrals ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400">Loading history...</div>
                    ) : verifiedReferrals.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-3">
                        <HistoryIcon size={40} className="opacity-20" />
                        <p className="font-bold">No verified earnings yet</p>
                        <p className="text-xs">When users sign up with your code, you'll earn ₦250 per entry.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {verifiedReferrals.map((u, i) => (
                          <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors w-full">
                            <div className="flex items-center gap-4 flex-1 truncate">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                                  <BadgeCheck size={20} />
                                </div>
                                <div className="truncate">
                                  <p className="font-bold text-zinc-900 dark:text-white text-sm sm:text-[15px] truncate">{u.full_name || 'Anonymous User'}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-1.5 py-0.5 rounded flex items-center gap-1 font-bold">
                                      <CheckCircle2 size={8} /> Verified
                                    </span>
                                    {u.created_at && (
                                        <span className="text-[10px] text-zinc-500 font-medium">
                                          {new Date(u.created_at).toLocaleDateString()}
                                        </span>
                                    )}
                                  </div>
                                </div>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <p className="font-black text-sm sm:text-lg text-emerald-600 dark:text-emerald-400 leading-none">+₦250</p>
                                <span className="text-[9px] sm:text-xs text-zinc-500 font-bold uppercase tracking-wider block mt-1">Earned</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
