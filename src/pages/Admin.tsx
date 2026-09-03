import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, getDoc, setDoc, doc, query, where, writeBatch } from 'firebase/firestore';
import { ArrowLeft, Loader2, Plus, List, FolderPlus, BookOpen, Edit2, Check, X, Crown, Search, Banknote, FileDown, FileUp, FileText, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { AUCHI_POLY_DEPARTMENTS, POLYTECHNIC_DEPARTMENTS, POLYTECHNIC_LEVELS, STANDARD_DEPARTMENTS, UNIVERSITY_LEVELS } from '../lib/constants';
import { extractCurriculumPdf, type ExtractedCurriculumPdf } from '../lib/curriculumPdf';

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab ] = useState<'courses' | 'topics' | 'manage' | 'payments' | 'withdrawals' | 'curriculum'>('courses');
  
  // Courses Form State
  const [department, setDepartment] = useState(AUCHI_POLY_DEPARTMENTS[0] || 'Computer Science');
  const [level, setLevel] = useState('ND1');
  const [courseCodes, setCourseCodes] = useState('');
  const [addingCourses, setAddingCourses] = useState(false);

  // Manage Courses Form State
  const [editingCourseId, setEditingCourseId] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [savingFields, setSavingFields] = useState(false);

  // Topics Form State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [topicsText, setTopicsText] = useState('');
  const [addingTopics, setAddingTopics] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<{id: string, title: string, code: string}[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Manual payment state
  const [users, setUsers] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending'>('pending');

  // Withdrawal requests
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);

  // Curriculum import state
  const [currDept, setCurrDept] = useState('Computer Science');
  const [currLevel, setCurrLevel] = useState('ND1');
  const [currSemester, setCurrSemester] = useState<1 | 2>(1);
  const [currProgramType, setCurrProgramType] = useState<'NBTE' | 'CCMAS'>('NBTE');
  const [currText, setCurrText] = useState('');
  const [currFile, setCurrFile] = useState<File | null>(null);
  const [pdfInfo, setPdfInfo] = useState<ExtractedCurriculumPdf | null>(null);
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsedCurriculum, setParsedCurriculum] = useState<any>(null);
  const [savingCurriculum, setSavingCurriculum] = useState(false);

  useEffect(() => {
    if (user && !user.is_admin) {
      toast.error('Unauthorized access');
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (activeTab === 'topics' || activeTab === 'manage') {
      fetchCoursesForTopics();
    }
  }, [activeTab, department, level]);

  useEffect(() => {
    if (activeTab === 'payments') {
      fetchRegisteredUsers();
    }
    if (activeTab === 'withdrawals') {
      fetchWithdrawals();
    }
  }, [activeTab]);

  const fetchWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const q = query(collection(db, 'withdrawal_requests'));
      const snapshot = await getDocs(q);
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      reqs.sort((a: any, b: any) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
      setWithdrawalRequests(reqs);
    } catch (e) {
      console.error("Error fetching withdrawals:", e);
      toast.error('Failed to load withdrawals');
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const handleApproveWithdrawal = async (req: any) => {
    if (!window.confirm(`Approve withdrawal of ₦${req.amount} for ${req.user_name}?`)) return;
    try {
      await setDoc(doc(db, 'withdrawal_requests', req.id), { status: 'approved' }, { merge: true });
      // Add to rep_withdrawn
      const userRef = doc(db, 'users', req.user_id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const u = userSnap.data();
        const currentWithdrawn = u.rep_withdrawn || 0;
        await setDoc(userRef, { rep_withdrawn: currentWithdrawn + req.amount }, { merge: true });
      }
      toast.success('Withdrawal approved');
      fetchWithdrawals();
    } catch (e) {
      toast.error('Failed to approve withdrawal');
    }
  };

  const handleDeclineWithdrawal = async (req: any) => {
    if (!window.confirm(`Decline withdrawal of ₦${req.amount} for ${req.user_name}?`)) return;
    try {
      await setDoc(doc(db, 'withdrawal_requests', req.id), { status: 'rejected' }, { merge: true });
      toast.success('Withdrawal declined');
      fetchWithdrawals();
    } catch (e) {
      toast.error('Failed to decline withdrawal');
    }
  };

  const fetchRegisteredUsers = async () => {
    setLoadingPayments(true);
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const fetchedUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching registered users:", error);
      toast.error("Failed to load users dashboard");
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleApprovePremium = async (targetUser: any) => {
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await setDoc(userRef, {
        is_pro: true,
        payment_status: 'approved'
      }, { merge: true });

      if (targetUser.used_coupon && targetUser.used_coupon !== 'OXSTINN' && targetUser.payment_status === 'awaiting_approval') {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('rep_coupon_code', '==', targetUser.used_coupon));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const repDoc = snapshot.docs[0];
          const repRef = doc(db, 'users', repDoc.id);
          const currentEarnings = repDoc.data().rep_earnings || 0;
          const currentUses = repDoc.data().coupon_uses || 0;
          await setDoc(repRef, {
            rep_earnings: currentEarnings + 250,
            coupon_uses: currentUses + 1
          }, { merge: true });
        }
      }

      toast.success(`Approved premium access for ${targetUser.full_name || 'user'}! 👑`);
      await fetchRegisteredUsers();
    } catch (error) {
      console.error("Error approving premium:", error);
      toast.error("Failed to approve user.");
    }
  };

  const handleDeclinePayment = async (targetUser: any) => {
    const confirmDecline = window.confirm(`Reset payment status for ${targetUser.full_name || 'user'} to standard idle tier?`);
    if (!confirmDecline) return;
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await setDoc(userRef, {
        payment_status: 'idle',
        payment_plan: null,
        payment_amount: null,
        payment_requested_at: null
      }, { merge: true });
      toast.success(`Reset payment status for ${targetUser.full_name || 'user'}.`);
      await fetchRegisteredUsers();
    } catch (error) {
      console.error("Error resetting payment:", error);
      toast.error("Failed to reset user payment status.");
    }
  };

  const handleRevokePremium = async (targetUser: any) => {
    const confirmRevoke = window.confirm(`Revoke premium for ${targetUser.full_name || 'user'}?`);
    if (!confirmRevoke) return;
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await setDoc(userRef, {
        is_pro: false,
        payment_status: 'idle'
      }, { merge: true });
      toast.success(`Revoked premium status for ${targetUser.full_name || 'user'}.`);
      await fetchRegisteredUsers();
    } catch (error) {
      console.error("Error revoking premium:", error);
      toast.error("Failed to revoke premium.");
    }
  };

  const handleToggleRep = async (targetUser: any) => {
    const isCurrentlyRep = !!targetUser.is_rep;
    const action = isCurrentlyRep ? 'Revoke' : 'Make';
    const confirmRep = window.confirm(`${action} ${targetUser.full_name || 'user'} as a Rep?`);
    if (!confirmRep) return;
    try {
      const userRef = doc(db, 'users', targetUser.id);
      await setDoc(userRef, {
        is_rep: !isCurrentlyRep
      }, { merge: true });
      toast.success(`Successfully updated Rep status for ${targetUser.full_name || 'user'}.`);
      await fetchRegisteredUsers();
    } catch (error) {
      console.error("Error toggling rep:", error);
      toast.error("Failed to update Rep status.");
    }
  };

  const fetchCoursesForTopics = async () => {
    setLoadingCourses(true);
    try {
      // Fetch courses for the selected department & level for Auchi Poly
      const coursesRef = collection(db, 'courses');
      const q = query(
        coursesRef, 
        where('school', '==', 'Auchi Polytechnic'),
        where('department', '==', department),
        where('level', '==', level)
      );
      
      const snapshot = await getDocs(q);
      const courses = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title || '',
        code: doc.data().code || ''
      }));
      setAvailableCourses(courses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      toast.error("Failed to fetch courses");
    } finally {
      setLoadingCourses(false);
    }
  };

  const handleBulkAddCourses = async () => {
    if (!courseCodes.trim()) {
      toast.error('Please enter course codes');
      return;
    }

    setAddingCourses(true);
    try {
      const lines = courseCodes.split('\n')
        .map(c => c.trim())
        .filter(c => c.length > 0);

      const batch = writeBatch(db);
      
      lines.forEach(line => {
        // e.g. COM 111 - INTRODUCTION TO COMPUTER SCIENCE
        const delimiterIndex = line.indexOf('-');
        let formattedCode = line;
        let title = line;

        if (delimiterIndex !== -1) {
          formattedCode = line.substring(0, delimiterIndex).trim().toUpperCase();
          title = line.substring(delimiterIndex + 1).trim();
        } else {
          formattedCode = line.toUpperCase();
        }
        
        const docId = `${department.replace(/[^a-zA-Z0-9]/g, '')}-${level}-${formattedCode.replace(/[^a-zA-Z0-9]/g, '')}`.toLowerCase();
        
        const courseRef = doc(db, 'courses', docId);
        batch.set(courseRef, {
          title: title, 
          code: formattedCode,
          school: 'Auchi Polytechnic',
          department: department,
          level: level,
          createdAt: new Date().toISOString()
        }, { merge: true }); 
      });

      await batch.commit();
      
      toast.success(`Successfully added ${lines.length} courses!`);
      setCourseCodes('');
    } catch (error) {
      console.error('Error adding courses:', error);
      toast.error('Failed to add courses');
    } finally {
      setAddingCourses(false);
    }
  };

  const handleBulkAddTopics = async () => {
    if (!selectedCourseId) {
      toast.error('Please select a course first');
      return;
    }
    if (!topicsText.trim()) {
      toast.error('Please enter topics');
      return;
    }

    setAddingTopics(true);
    try {
      const lines = topicsText.split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      const batch = writeBatch(db);
      const courseTopicsRef = collection(db, `courses/${selectedCourseId}/topics`);
      
      let currentChapterTitle = 'General Concepts';
      let currentChapterOrder = 1;
      let topicIdx = 0;

      lines.forEach((line) => {
        // Check if line is a chapter heading, e.g., "Chapter 1: Introduction"
        const chapterMatch = line.match(/^Chapter\s+(\d+)[.:\-\s]*(.*)$/i);
        if (chapterMatch) {
          currentChapterOrder = parseInt(chapterMatch[1], 10);
          currentChapterTitle = chapterMatch[2].trim() || `Chapter ${currentChapterOrder}`;
        } else {
          const topicId = line.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
          const newTopicRef = doc(courseTopicsRef, `${currentChapterOrder}-${topicId}`);
          
          batch.set(newTopicRef, {
            title: line,
            order: topicIdx++,
            chapter: currentChapterTitle,
            chapter_order: currentChapterOrder,
            estimated_minutes: 10,
            createdAt: new Date().toISOString()
          }, { merge: true });
        }
      });

      await batch.commit();
      toast.success(`Successfully added topics and chapters!`);
      setTopicsText('');
    } catch (error) {
      console.error('Error adding topics:', error);
      toast.error('Failed to add topics');
    } finally {
      setAddingTopics(false);
    }
  };

  const handleSaveCourse = async (courseId: string) => {
    if (!editCode.trim() || !editTitle.trim()) {
      toast.error('Course Code and Title cannot be empty');
      return;
    }
    setSavingFields(true);
    try {
      const courseRef = doc(db, 'courses', courseId);
      await setDoc(courseRef, {
        code: editCode.trim().toUpperCase(),
        title: editTitle.trim(),
      }, { merge: true });
      toast.success('Course details updated successfully!');
      setEditingCourseId('');
      // Refresh local available courses list
      await fetchCoursesForTopics();
    } catch (error) {
      console.error('Error updating course:', error);
      toast.error('Failed to update course details');
    } finally {
      setSavingFields(false);
    }
  };

  const handleParseCurriculum = async () => {
    if (!currText.trim()) {
      toast.error('Please paste curriculum text first');
      return;
    }
    setParsing(true);
    setParsedCurriculum(null);
    try {
      const res = await fetch('/api/parse-curriculum', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currText,
          department: currDept,
          level: currLevel,
          semester: currSemester,
          programType: currProgramType,
          source: pdfInfo?.source === 'NBTE' || pdfInfo?.source === 'CCMAS' ? pdfInfo.source : currProgramType
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error parsing curriculum');
      if (!data.courses?.length) {
        toast.error('No courses found. Try pasting a more complete section of the curriculum PDF.');
        return;
      }
      setParsedCurriculum(data);
      toast.success(`Found ${data.courses.length} courses! Review below and save.`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to parse curriculum');
    } finally {
      setParsing(false);
    }
  };

  const handleSaveCurriculum = async () => {
    if (!parsedCurriculum?.courses?.length) return;
    setSavingCurriculum(true);
    try {
      let totalTopics = 0;
      for (const course of parsedCurriculum.courses) {
        const courseLevel = course.level || currLevel;
        const courseSemester = course.semester === 1 || course.semester === 2
          ? course.semester
          : currProgramType === 'NBTE' && (!pdfInfo || pdfInfo.detectedSemesters.length <= 1)
            ? currSemester
            : undefined;
        const safeCode = course.code.replace(/[^a-zA-Z0-9]/g, '');
        const docId = `${currDept.replace(/[^a-zA-Z0-9]/g, '')}-${courseLevel.replace(/[^a-zA-Z0-9]/g, '')}-s${courseSemester ?? 'all'}-${safeCode}`.toLowerCase();
        const courseRef = doc(db, 'courses', docId);
        const coursePayload: Record<string, any> = {
          code: course.code.trim().toUpperCase(),
          title: course.title.trim(),
          school: currProgramType,
          department: currDept,
          level: courseLevel,
          credit_units: course.credit_units || 2,
          program_type: currProgramType === 'NBTE' ? 'polytechnic' : 'university',
          source: currProgramType,
          description: `${course.title} — ${currDept}, ${courseLevel}${courseSemester ? `, Semester ${courseSemester}` : ''}`,
          createdAt: new Date().toISOString()
        };
        if (courseSemester) {
          coursePayload.semester = courseSemester;
        }
        await setDoc(courseRef, coursePayload, { merge: true });

        if (course.topics?.length) {
          const batch = writeBatch(db);
          const topicsRef = collection(db, `courses/${docId}/topics`);
          course.topics.forEach((topic: any, idx: number) => {
            const safeTitle = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40);
            const topicId = `${topic.chapter_order || 1}-${idx + 1}-${safeTitle}`;
            const topicRef = doc(topicsRef, topicId);
            batch.set(topicRef, {
              title: topic.title,
              chapter: topic.chapter || 'General Topics',
              chapter_order: topic.chapter_order || 1,
              order: topic.order || idx + 1,
              estimated_minutes: 10,
              createdAt: new Date().toISOString()
            }, { merge: true });
            totalTopics++;
          });
          await batch.commit();
        }
      }
      toast.success(`✅ Saved ${parsedCurriculum.courses.length} courses with ${totalTopics} topics!`);
      setParsedCurriculum(null);
      setCurrText('');
      setCurrFile(null);
      setPdfInfo(null);
    } catch (e: any) {
      console.error('Save curriculum error:', e);
      toast.error(e.message || 'Failed to save curriculum');
    } finally {
      setSavingCurriculum(false);
    }
  };

  const handleCurriculumPdfUpload = async (file?: File) => {
    if (!file) return;
    setCurrFile(file);
    setExtractingPdf(true);
    setParsedCurriculum(null);
    try {
      const extracted = await extractCurriculumPdf(file);
      setPdfInfo(extracted);
      setCurrText(extracted.text);

       if (extracted.source === 'CCMAS') {
         setCurrFile(null);
         setPdfInfo(null);
         setCurrText('');
         toast.error('University/CCMAS importing is not enabled yet. Please upload an NBTE polytechnic curriculum.');
         return;
       }
       if (extracted.source === 'NBTE') {
         setCurrProgramType('NBTE');
      }
      if (extracted.suggestedDepartment) {
        const departmentMatch = (extracted.source === 'NBTE' ? POLYTECHNIC_DEPARTMENTS : [...POLYTECHNIC_DEPARTMENTS, 'Computer Science'])
          .find(dept => dept.toLowerCase() === extracted.suggestedDepartment?.toLowerCase());
        if (departmentMatch) setCurrDept(departmentMatch);
      }
      if (extracted.detectedLevels.length === 1) {
        setCurrLevel(extracted.detectedLevels[0]);
      }
      if (extracted.detectedSemesters.length === 1) {
        setCurrSemester(extracted.detectedSemesters[0] as 1 | 2);
      }
      toast.success(`Extracted text from ${extracted.pageCount} pages. Review it below before parsing.`);
    } catch (error: any) {
      setCurrFile(null);
      setPdfInfo(null);
      toast.error(error.message || 'Could not extract text from this PDF');
    } finally {
      setExtractingPdf(false);
    }
  };

  const clearCurriculumPdf = () => {
    setCurrFile(null);
    setPdfInfo(null);
    setCurrText('');
    setParsedCurriculum(null);
  };

  if (!user?.is_admin) return null;

  return (
    <div className="h-full w-full flex flex-col p-4 sm:p-6 overflow-hidden">
      <div className="w-full max-w-2xl mx-auto flex flex-col h-full overflow-y-auto hide-scrollbar">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-4 mb-6">
          <button 
            onClick={() => navigate('/profile')}
            className="w-10 h-10 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-100 dark:border-zinc-850"
          >
            <ArrowLeft size={18} className="text-zinc-700 dark:text-zinc-300" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">Admin Workspace</h1>
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Content Management Panel</p>
          </div>
        </div>

        {/* Global Selectors */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white mb-3">Context (Auchi Polytechnic)</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary h-11 appearance-none"
              >
                {AUCHI_POLY_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-primary h-11 appearance-none"
              >
                {['100L', '200L', '300L', '400L', '500L', 'ND1', 'ND2', 'HND1', 'HND2'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('courses')}
            className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'courses' 
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' 
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <FolderPlus size={16} />
            Add Courses
          </button>
          
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'manage' 
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' 
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Edit2 size={16} />
            Manage Courses
          </button>

          <button
            onClick={() => setActiveTab('topics')}
            className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'topics' 
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' 
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <BookOpen size={16} />
            Add Topics
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'payments' 
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/10' 
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Crown size={16} className={activeTab === 'payments' ? "text-white" : "text-amber-500"} />
            Verify Payments
          </button>

          <button
            onClick={() => setActiveTab('curriculum')}
            className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'curriculum'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <FileDown size={16} />
            Import Curriculum
          </button>

          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`flex-1 min-w-[100px] py-3 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-bold transition-all ${
              activeTab === 'withdrawals' 
                ? 'bg-emerald-500 text-white shadow-md' 
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Banknote size={16} className={activeTab === 'withdrawals' ? "text-white" : "text-emerald-500"} />
            Withdrawals
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'courses' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-1">
                <List size={20} className="text-blue-500" />
                Bulk Paste Course Codes
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Paste one course code per line (e.g. COM 111). They will be added to Auchi Polytechnic ({department} - {level}).
              </p>
            </div>
            
            <textarea
              value={courseCodes}
              onChange={(e) => setCourseCodes(e.target.value)}
              placeholder={"COM 111 - INTRODUCTION TO COMPUTER SCIENCE\nCOM 112 - INTRODUCTION TO SOFTWARE ENGINEERING\nCOM 113 - INTRODUCTION TO PROGRAMMING"}
              className="w-full h-48 bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />

            <button
              onClick={handleBulkAddCourses}
              disabled={addingCourses || !courseCodes.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingCourses ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
              {addingCourses ? 'Adding...' : 'Create Courses'}
            </button>
          </div>
        )}

        {activeTab === 'manage' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-1">
                <Edit2 size={20} className="text-sky-500" />
                Manage & Edit Courses
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Below are the courses currently added under Auchi Polytechnic ({department} - {level}).
              </p>
            </div>

            {loadingCourses ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-sm text-zinc-500">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                <span>Loading courses...</span>
              </div>
            ) : availableCourses.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                No courses found for this level and department. Paste them in "Add Courses" first.
              </div>
            ) : (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {availableCourses.map((course) => {
                  const isEditing = editingCourseId === course.id;
                  return (
                    <div 
                      key={course.id} 
                      className={`p-4 rounded-xl border transition-all ${
                        isEditing 
                          ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/10' 
                          : 'border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:border-zinc-200 dark:hover:border-zinc-700'
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-1">
                              <label className="block text-[10px] uppercase tracking-wider font-extrabold text-zinc-500 dark:text-zinc-400 mb-1">Code</label>
                              <input
                                type="text"
                                value={editCode}
                                onChange={(e) => setEditCode(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-black text-zinc-900 dark:text-white uppercase outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[10px] uppercase tracking-wider font-extrabold text-zinc-500 dark:text-zinc-400 mb-1">Course Title / Name</label>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                            <button
                              type="button"
                              onClick={() => setEditingCourseId('')}
                              disabled={savingFields}
                              className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <X size={14} /> Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveCourse(course.id)}
                              disabled={savingFields}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              {savingFields ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Check size={14} />
                              )}
                              {savingFields ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 text-[11px] font-black tracking-wide">
                              {course.code}
                            </span>
                            <h4 className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                              {course.title || course.code}
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCourseId(course.id);
                              setEditCode(course.code);
                              setEditTitle(course.title);
                            }}
                            className="p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-750 text-zinc-650 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/10 transition-colors shadow-sm cursor-pointer"
                            title="Edit Code or Title"
                          >
                            <Edit2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'topics' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-1">
                <List size={20} className="text-green-500" />
                Bulk Paste Topics
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                First select a course, then paste topics (one per line).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5 uppercase tracking-wider">Select Course</label>
              {loadingCourses ? (
                <div className="w-full h-11 bg-zinc-100 dark:bg-zinc-800 rounded-xl animate-pulse flex items-center px-4 text-xs text-zinc-500">Loading courses...</div>
              ) : (
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none h-11 appearance-none"
                >
                  <option value="">-- Choose a Course --</option>
                  {availableCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.code} {c.title && c.title !== c.code ? `- ${c.title}` : ''}</option>
                  ))}
                </select>
              )}
            </div>
            
            <textarea
              value={topicsText}
              onChange={(e) => setTopicsText(e.target.value)}
              placeholder={"Introduction to Computers\nNumber Systems\nLogic Gates\n..."}
              className="w-full h-48 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-green-500 outline-none resize-none"
            />

            <button
              onClick={handleBulkAddTopics}
              disabled={addingTopics || !topicsText.trim() || !selectedCourseId}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingTopics ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} strokeWidth={3} />}
              {addingTopics ? 'Adding...' : 'Create Topics'}
            </button>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4 pb-12">
            {/* Header copy */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2 mb-1">
                <Crown size={20} className="text-amber-500 animate-pulse" />
                Premium Ledger Approvals
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Verify receipt of bank transfers (OPay / Palmpay) in your banking ledger. Cross-check each user's unique Account ID provided in their transaction remarks.
              </p>
            </div>

            {/* Dashboard Filters & Search */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-sm space-y-3.5">
              {/* Pill Switcher */}
              <div className="flex gap-2 p-1 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                <button
                  type="button"
                  onClick={() => setFilterMode('pending')}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    filterMode === 'pending'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <span>Pending Validation</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    filterMode === 'pending'
                      ? 'bg-white/25 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400'
                  }`}>
                    {users.filter(u => u.payment_status === 'awaiting_approval').length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`flex-1 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    filterMode === 'all'
                      ? 'bg-zinc-900 dark:bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <span>All Registered Users</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    filterMode === 'all'
                      ? 'bg-white/10 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-400'
                  }`}>
                    {users.length}
                  </span>
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-zinc-450 dark:text-zinc-500">
                  <Search size={16} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Insert Account ID (e.g. KORTEX-...), name, email..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl pl-10 pr-4 py-3 text-xs font-bold text-zinc-900 dark:text-white tracking-wide focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* List block */}
            {loadingPayments ? (
              <div className="py-16 text-center space-y-3 font-semibold text-xs text-zinc-500">
                <Loader2 size={24} className="animate-spin text-amber-500 mx-auto" />
                <span>Synchronizing database ledger entries...</span>
              </div>
            ) : (
              <div className="space-y-3.5">
                {(() => {
                  // Filter logic
                  const filtered = users.filter((u) => {
                    // Search criteria matching
                    const accountCode = `KORTEX-${u.id.substring(0, 8).toUpperCase()}`;
                    const matchesQuery = 
                      accountCode.includes(searchQuery.toUpperCase()) ||
                      (u.id?.toUpperCase() || '').includes(searchQuery.toUpperCase()) ||
                      (u.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                      (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase());

                    if (filterMode === 'pending') {
                      return u.payment_status === 'awaiting_approval' && matchesQuery;
                    }
                    return matchesQuery;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center text-xs text-zinc-500 font-semibold shadow-sm">
                        No registered subscribers matched the searching criteria.
                      </div>
                    );
                  }

                  return filtered.map((u) => {
                    const studentIdCode = `KORTEX-${u.id.substring(0, 8).toUpperCase()}`;
                    const formattedDate = u.payment_requested_at 
                      ? new Date(u.payment_requested_at).toLocaleString() 
                      : null;

                    return (
                      <div 
                        key={u.id}
                        className={`bg-white dark:bg-zinc-900 border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                          u.payment_status === 'awaiting_approval'
                            ? 'border-amber-500/55 bg-amber-500/5 dark:bg-amber-950/5'
                            : 'border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        {/* Profile Meta Column */}
                        <div className="space-y-2 min-w-0 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-zinc-900 dark:text-white truncate max-w-[180px]">
                              {u.full_name || 'Anonymous registration'}
                            </h4>
                            
                            {/* Pro Badge indicator */}
                            {u.is_pro ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-wider border border-emerald-500/15">
                                Pro Active 👑
                              </span>
                            ) : u.payment_status === 'awaiting_approval' ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[9px] font-black uppercase tracking-wider border border-amber-500/20 animate-pulse">
                                Verification Pending
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[9px] font-bold">
                                Free Tier
                              </span>
                            )}
                            
                            {u.is_rep && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[9px] font-black uppercase tracking-wider border border-blue-500/20">
                                Rep
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] font-semibold text-zinc-400 space-y-0.5">
                            <p className="truncate max-w-[200px]">{u.email}</p>
                            <p>{u.department || 'No department'} • {u.level || 'No level'}</p>
                            <div className="flex items-center gap-1 mt-1 text-zinc-700 dark:text-zinc-200">
                              <span>Account ID:</span>
                              <strong className="font-mono font-black text-amber-600 dark:text-amber-500 bg-amber-500/5 px-1.5 py-0.5 rounded text-[11px]">
                                {studentIdCode}
                              </strong>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(studentIdCode);
                                  toast.success("Account ID copied to check transaction narative ledger.");
                                }}
                                className="text-[9px] font-extrabold uppercase bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-750 px-1 py-0.5 rounded text-zinc-500 ml-1"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          {/* Extra info for transfers requested */}
                          {u.payment_status === 'awaiting_approval' && (
                            <div className="text-[10.5px] border-l-2 border-amber-400 pl-2.5 mt-2 space-y-0.5 bg-amber-500/5 py-1 pr-2 rounded">
                              <p className="text-zinc-800 dark:text-zinc-200 font-extrabold">
                                Requested: <span className="text-amber-500 capitalize">{u.payment_plan || 'Semester'} Pass</span>
                              </p>
                              <p className="text-zinc-500 font-medium">
                                Amount Transfer: <strong className="text-zinc-800 dark:text-zinc-100">₦{(u.payment_amount || 5000).toLocaleString()}</strong>
                              </p>
                              {formattedDate && (
                                <p className="text-[9.5px] text-zinc-450 font-normal">
                                  Sent: {formattedDate}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons list */}
                        <div className="flex gap-2 flex-wrap shrink-0">
                          {u.payment_status === 'awaiting_approval' && (
                            <>
                              <button
                                onClick={() => handleApprovePremium(u)}
                                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1"
                              >
                                <Check size={14} strokeWidth={3} /> Approve
                              </button>
                              <button
                                onClick={() => handleDeclinePayment(u)}
                                className="px-3 py-2 bg-white hover:bg-neutral-50 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-750 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                              >
                                Decline
                              </button>
                            </>
                          )}

                          {!u.is_pro && u.payment_status !== 'awaiting_approval' && (
                            <button
                              onClick={() => handleApprovePremium(u)}
                              className="px-3 py-2 bg-zinc-900 border border-zinc-750 hover:bg-zinc-850 dark:bg-white dark:hover:bg-neutral-50 dark:text-zinc-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                              Force Upgrade Pro
                            </button>
                          )}

                          {u.is_pro && (
                            <button
                              onClick={() => handleRevokePremium(u)}
                              className="px-3 py-2 border border-rose-250 hover:bg-rose-500/10 text-rose-500 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                              Revoke Pro
                            </button>
                          )}
                          
                          <button
                            onClick={() => handleToggleRep(u)}
                            className={`px-3 py-2 border font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                              u.is_rep 
                                ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20' 
                                : 'bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {u.is_rep ? 'Revoke Rep' : 'Make Rep'}
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {/* Curriculum Import */}
        {activeTab === 'curriculum' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-5">
            <div>
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">Import Curriculum PDF</h2>
              <p className="text-xs text-zinc-500 mt-1">
                 Upload an official NBTE polytechnic PDF. Kortex extracts its selectable text in your browser first, then DeepSeek organizes ND and HND courses into topics.
              </p>
            </div>

            <div className="rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/60 dark:bg-blue-950/20 p-5">
              <input
                id="curriculumPdfInput"
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  void handleCurriculumPdfUpload(file);
                  e.currentTarget.value = '';
                }}
              />
              {!currFile ? (
                <label htmlFor="curriculumPdfInput" className="flex flex-col items-center justify-center gap-2 cursor-pointer text-center">
                  <span className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <FileUp size={23} />
                  </span>
                  <span className="font-black text-sm text-blue-950 dark:text-blue-100">Choose curriculum PDF</span>
                   <span className="text-[11px] text-blue-700/70 dark:text-blue-300/70">Supports long text-based ND and HND curriculum documents</span>
                </label>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 shrink-0 rounded-xl bg-white dark:bg-zinc-900 text-blue-600 flex items-center justify-center border border-blue-100 dark:border-blue-900">
                    {extractingPdf ? <Loader2 size={19} className="animate-spin" /> : <FileText size={19} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm text-zinc-900 dark:text-white truncate">{currFile.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {extractingPdf ? 'Extracting selectable text locally…' : pdfInfo ? `${pdfInfo.pageCount} pages · ${Math.round(pdfInfo.text.length / 1000)}k characters extracted` : 'Preparing PDF…'}
                    </p>
                  </div>
                  {!extractingPdf && (
                    <button type="button" onClick={clearCurriculumPdf} className="p-2 rounded-lg hover:bg-white/70 dark:hover:bg-zinc-900 text-zinc-500" title="Remove PDF">
                      <X size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {pdfInfo && (
              <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400">Extraction complete</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-white mt-1">
                      {pdfInfo.source === 'unknown' ? 'Curriculum type not detected' : `${pdfInfo.source} curriculum detected`}
                    </p>
                  </div>
                  <button type="button" onClick={() => void handleCurriculumPdfUpload(currFile!)} disabled={extractingPdf} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <RotateCcw size={13} /> Re-extract
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                  <span className="px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">{pdfInfo.pageCount} pages</span>
                  {pdfInfo.detectedLevels.map(item => <span key={item} className="px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">{item}</span>)}
                  {pdfInfo.detectedSemesters.map(item => <span key={item} className="px-2 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">Semester {item}</span>)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Department</label>
                <select value={currDept} onChange={e => setCurrDept(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 h-11 appearance-none">
                  {(currProgramType === 'NBTE' ? POLYTECHNIC_DEPARTMENTS : STANDARD_DEPARTMENTS).map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Level</label>
                <select value={currLevel} onChange={e => setCurrLevel(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 h-11 appearance-none">
                  {(currProgramType === 'NBTE' ? POLYTECHNIC_LEVELS : UNIVERSITY_LEVELS).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Semester</label>
                <select value={currSemester} onChange={e => setCurrSemester(Number(e.target.value) as 1 | 2)} disabled={currProgramType === 'CCMAS'} className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 h-11 appearance-none disabled:opacity-60">
                  {currProgramType === 'CCMAS' ? (
                    <option value={1}>Not applicable — level-based</option>
                  ) : (
                    <>
                      <option value={1}>1st Semester</option>
                      <option value={2}>2nd Semester</option>
                    </>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Curriculum Source</label>
                <select
                  value={currProgramType}
                  onChange={e => {
                    const nextSource = e.target.value as 'NBTE' | 'CCMAS';
                    setCurrProgramType(nextSource);
                    setCurrDept(nextSource === 'NBTE' ? 'Computer Science' : 'Computer Science');
                    setCurrLevel(nextSource === 'NBTE' ? 'ND1' : '100 Level');
                  }}
                  className="w-full bg-zinc-50 dark:bg-zinc-800 border-none rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white focus:ring-2 focus:ring-blue-500 h-11 appearance-none"
                >
                  <option value="NBTE">NBTE — Polytechnic</option>
                  <option value="CCMAS" disabled>CCMAS — University (coming later)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3 mb-1">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Extracted Curriculum Text</label>
                <span className="text-[10px] font-mono text-zinc-400">{currText.length.toLocaleString()} chars</span>
              </div>
              <textarea
                value={currText}
                onChange={e => setCurrText(e.target.value)}
                rows={12}
                placeholder="Upload a PDF above, or paste extracted curriculum text here."
                className="w-full bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs text-zinc-900 dark:text-white font-mono resize-y outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-zinc-400 mt-1">You can edit the extracted text before parsing if the PDF has a title or section you want to remove.</p>
            </div>

            <button
              onClick={handleParseCurriculum}
              disabled={parsing || extractingPdf || !currText.trim()}
              className="w-full py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {parsing ? (
                <><Loader2 size={16} className="animate-spin" /> Extracting with DeepSeek AI...</>
              ) : (
                <><FileDown size={16} /> Extract Courses and Topics with AI</>
              )}
            </button>

            {parsedCurriculum && (
              <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="font-black text-zinc-900 dark:text-white text-base">
                      {parsedCurriculum.courses?.length} course{parsedCurriculum.courses?.length !== 1 ? 's' : ''} found
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Review below, then save to the student library.</p>
                  </div>
                  <button
                    onClick={handleSaveCurriculum}
                    disabled={savingCurriculum}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingCurriculum ? (
                      <><Loader2 size={14} className="animate-spin" /> Saving...</>
                    ) : (
                      <>Save {parsedCurriculum.courses?.length} Courses to Library</>
                    )}
                  </button>
                </div>
                <div className="space-y-3">
                  {parsedCurriculum.courses?.map((course: any, i: number) => (
                    <div key={i} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="font-mono text-[10px] font-black text-zinc-400 uppercase tracking-widest">{course.code}</span>
                          <p className="font-black text-zinc-900 dark:text-white text-sm mt-0.5">{course.title}</p>
                        </div>
                        <span className="text-[10px] font-black bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                          {course.credit_units || 2} units · {course.topics?.length || 0} topics
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {course.topics?.slice(0, 6).map((t: any, j: number) => (
                          <span key={j} className="text-[10px] font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full">
                            {t.title.length > 35 ? t.title.substring(0, 35) + '…' : t.title}
                          </span>
                        ))}
                        {(course.topics?.length ?? 0) > 6 && (
                          <span className="text-[10px] font-medium text-zinc-400 px-1 py-0.5">
                            +{course.topics.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Withdrawals */}
        {activeTab === 'withdrawals' && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm space-y-4">
            <h2 className="text-xl font-black text-zinc-900 dark:text-white">Withdrawal Requests</h2>
            {loadingWithdrawals ? (
              <div className="flex flex-col items-center justify-center py-20 text-emerald-500">
                <Loader2 size={32} className="animate-spin mb-4" />
                <p className="font-bold tracking-tight text-sm">Loading requests...</p>
              </div>
            ) : withdrawalRequests.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-800/20">
                <p className="text-zinc-500 font-bold mb-1">No withdrawal requests.</p>
                <p className="text-xs font-semibold text-zinc-400">Everything is caught up.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawalRequests.map((req) => (
                  <div key={req.id} className="p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/10 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-zinc-900 dark:text-white text-sm">{req.user_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider ${
                          req.status === 'pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                          req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                          'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 font-medium">{req.user_email}</p>
                      <div className="text-xs text-zinc-400 mt-2 p-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm inline-block">
                        <p>Bank: <strong className="text-zinc-700 dark:text-zinc-300">{req.bank_name}</strong></p>
                        <p>Account details: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{req.account_number}</strong></p>
                        <p>Account Name: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{req.account_name}</strong></p>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-2">{new Date(req.requested_at).toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto mt-2 md:mt-0">
                      <p className="text-xl font-black text-zinc-900 dark:text-white">₦{req.amount?.toLocaleString()}</p>
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleApproveWithdrawal(req)}
                            className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white px-3 border border-emerald-500/20 py-2 rounded-xl text-xs font-bold transition-all"
                          >
                            Approve & Pay
                          </button>
                          <button 
                            onClick={() => handleDeclineWithdrawal(req)}
                            className="bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white px-3 border border-rose-500/20 py-2 rounded-xl text-xs font-bold transition-all"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
