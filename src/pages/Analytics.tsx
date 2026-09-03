import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Flame, GraduationCap, Crown, School, Building, Milestone, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import type { Course, Topic } from '../types';
import LoadingScreen, { LoadingSpinner } from '../components/LoadingScreen';

export default function Analytics() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [coursesCount, setCoursesCount] = useState(0);
  const [continueLearning, setContinueLearning] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchedRef = useRef(false);
  const prevUserRef = useRef({ id: '', school: '', department: '', level: '' });

  // Fetch real user courses, metrics, and recent views from Firestore database
  useEffect(() => {
    async function fetchUserCoursesAndMetrics() {
      try {
        if (continueLearning.length === 0) {
          setLoading(true);
        }
        
        // Fetch academic courses
        const coursesPromise = getDocs(query(collection(db, 'courses')));
        
        // Fetch recent views
        const recentViewsPromise = getDocs(query(
          collection(db, `users/${user?.id}/recent_views`),
          orderBy('lastViewedAt', 'desc'),
          limit(4)
        ));

        const [coursesSnapshot, recentViewsSnapshot] = await Promise.all([coursesPromise, recentViewsPromise]);
        
        // Filter courses
        let coursesData: Course[] = coursesSnapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as Course));

        if (user) {
          const isPoly = user.school?.toLowerCase().includes('polytechnic') || user.school?.toLowerCase().includes('college');
          let activeSchool = user.school;
          const hasSpecificSchoolCourses = coursesData.some(c => c.school === user.school);
          if (!hasSpecificSchoolCourses) {
            activeSchool = isPoly ? 'Auchi Polytechnic' : 'University of Benin (UNIBEN)';
          }

          const departments = [user.department, 'General'].filter((v, i, a) => v && a.indexOf(v) === i);
          coursesData = coursesData.filter(c => 
            (c.school === activeSchool || (isPoly && c.school === 'NBTE') || (!isPoly && c.school === 'CCMAS')) &&
            departments.includes(c.department) &&
            (c.level?.replace(/\s+/g, '') === user.level?.replace(/\s+/g, '') || c.level === 'All Levels' || !c.level)
          );
        }
        setCoursesCount(coursesData.length);

        // Fetch continue learning details
        const continueLearningPromises = recentViewsSnapshot.docs.map(async (viewDoc) => {
          const viewData = viewDoc.data();
          const courseRef = doc(db, 'courses', viewData.courseId);
          const courseDoc = await getDoc(courseRef);
          
          if (courseDoc.exists()) {
            const course = { id: courseDoc.id, ...courseDoc.data() } as Course;
            const topicsSnapshot = await getDocs(query(collection(db, `courses/${course.id}/topics`), limit(1)));
            course.topics = topicsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Topic));
            return course;
          }
          return null;
        });

        const rawContinue = (await Promise.all(continueLearningPromises)).filter(Boolean) as Course[];
        const seenIds = new Set<string>();
        const continueLearningData: Course[] = [];
        for (const c of rawContinue) {
          if (c && !seenIds.has(c.id)) {
            seenIds.add(c.id);
            continueLearningData.push(c);
          }
        }
        setContinueLearning(continueLearningData);

      } catch (error) {
        console.error("Error fetching courses for analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    if (user?.id) {
      const userChanged = 
        prevUserRef.current.id !== user.id ||
        prevUserRef.current.school !== user.school ||
        prevUserRef.current.department !== user.department ||
        prevUserRef.current.level !== user.level;

      if (userChanged || !fetchedRef.current) {
        prevUserRef.current = {
          id: user.id || '',
          school: user.school || '',
          department: user.department || '',
          level: user.level || ''
        };
        fetchedRef.current = true;
        fetchUserCoursesAndMetrics();
      }
    }
  }, [user?.id, user?.school, user?.department, user?.level]);

  const streakCount = user?.streak || 0;
  const isPro = user?.is_pro === true;

  return (
    <div className="h-full w-full flex flex-col p-2 sm:p-4 md:p-6 overflow-hidden pb-20">
      <div className="w-full max-w-7xl mx-auto flex flex-col h-full overflow-y-auto hide-scrollbar gap-6 sm:gap-8 pt-2">
        {/* Header & User Profile Info */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-805 transition-colors border border-zinc-100 dark:border-zinc-800 z-50 cursor-pointer relative pointer-events-auto shadow-sm"
              style={{ pointerEvents: 'auto' }}
            >
              <ArrowLeft size={22} className="text-zinc-700 dark:text-zinc-300" />
            </button>
            <div className="flex-1 flex justify-between items-center">
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-none">Learning Insights</h1>
              </div>
              {/* Pro Badge */}
              <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-widest ${isPro ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                {isPro && <Crown size={14} strokeWidth={3} />}
                {isPro ? 'PRO' : 'FREE'}
              </div>
            </div>
          </div>
          
          {/* User Academic details */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800/70 px-4 py-2 rounded-xl">
              <School size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{user?.school || 'School not set'}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800/70 px-4 py-2 rounded-xl">
              <Building size={16} className="text-purple-600 dark:text-purple-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{user?.department || 'Dept not set'}</span>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 dark:bg-zinc-900 dark:border-zinc-800/70 px-4 py-2 rounded-xl">
              <Milestone size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{user?.level || 'Level not set'}</span>
            </div>
          </div>
        </div>

        {/* Big Impact Numbers */}
        <div className="grid grid-cols-2 gap-4 lg:gap-6 shrink-0 w-full">
          {/* Day Streak */}
          <div className="bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] dark:from-amber-950/20 dark:to-amber-900/10 border border-amber-100/70 dark:border-amber-950/30 rounded-[24px] shadow-sm p-4 sm:p-6 flex flex-col items-center justify-center text-center h-[140px] sm:h-[160px] gap-1 transition-all">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-amber-500 dark:text-amber-400 mb-1 shadow-sm border border-amber-100/30">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-900 dark:text-amber-200">
              {streakCount}
            </h2>
            <span className="text-[9px] sm:text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-100/50 dark:bg-amber-800/20 px-2 sm:px-3 py-0.5 rounded-full mt-0.5">
              Day Streak
            </span>
          </div>

          {/* Courses */}
          <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] dark:from-purple-950/20 dark:to-purple-900/10 border border-purple-100/70 dark:border-purple-950/30 rounded-[24px] shadow-sm p-4 sm:p-6 flex flex-col items-center justify-center text-center h-[140px] sm:h-[160px] gap-1 transition-all">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-1 shadow-sm border border-purple-100/30">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-[#2E1065] dark:text-purple-200">
              {loading ? '-' : coursesCount}
            </h2>
            <span className="text-[9px] sm:text-[10px] font-black text-purple-600 dark:text-purple-450 uppercase tracking-widest bg-purple-100/50 dark:bg-purple-800/20 px-2 sm:px-3 py-0.5 rounded-full mt-0.5">
              Courses
            </span>
          </div>
        </div>

        {/* Daily Streak Graph */}
        <div className="w-full shrink-0">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm sm:text-base tracking-tight">Weekly Activity Log</h3>
          </div>

          <div className="bg-slate-100/80 dark:bg-slate-800/50 rounded-[32px] p-3 sm:p-4 flex justify-between items-center gap-2 sm:gap-3 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
            {Array.from({ length: 7 }).map((_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - 3 + i);
              const isToday = i === 3;
              const dateStr = date.toISOString().split('T')[0];
              const dayStats = user?.academic_stats_by_date?.[dateStr];
              const isCompleted = !!dayStats && (
                (dayStats.answered ?? 0) > 0 ||
                (dayStats.finished_reading ?? 0) > 0 ||
                (dayStats.started_reading ?? 0) > 0
              );

              const dayName = date.toLocaleDateString('en-US', { weekday: 'narrow' });
              const dayDate = date.getDate();

               return (
                <div 
                  key={i} 
                  className={`flex-1 flex flex-col items-center justify-between py-3 sm:py-4 rounded-[100px] relative transition-all duration-300 ${
                    isCompleted 
                      ? "bg-[#FDF3C7] dark:bg-amber-500/15 border-b-2 border-r-2 border-[#F3E29F] dark:border-amber-500/35 shadow-sm z-10" 
                      : "bg-white dark:bg-slate-800 border-b border-r border-[#E2E8F0] dark:border-slate-700/50"
                  } ${isToday ? 'scale-105 z-20 ring-4 ring-amber-400/55' : ''}`}
                  style={{ minHeight: '90px' }}
                >
                  <span className={`text-[11px] sm:text-xs font-black mt-1 uppercase ${isCompleted ? 'text-slate-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    {dayName}
                  </span>

                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-extrabold text-xs sm:text-sm ${
                    isCompleted 
                      ? "bg-white text-slate-900 dark:bg-amber-500 dark:text-zinc-950 shadow-sm" 
                      : "text-slate-800 dark:text-zinc-100"
                  }`}>
                    {dayDate}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Latest Topics Read */}
        <div className="w-full shrink-0 flex flex-col pb-8">
          <div className="flex items-center justify-between mb-4 px-1">
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm sm:text-base tracking-tight">Recent Learning Activities</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 flex-1">
            {loading ? (
              <>
                <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-[24px] animate-pulse"></div>
                <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-[24px] animate-pulse"></div>
                <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-[24px] animate-pulse"></div>
                <div className="h-44 bg-slate-100 dark:bg-slate-800 rounded-[24px] animate-pulse"></div>
              </>
            ) : continueLearning.length > 0 ? (
              continueLearning.map((course, idx) => {
                const topic = course.topics?.[0];
                if (!topic) return null;
                return (
                  <div 
                    key={`an-cl-${course.id}-${topic.id}-${idx}`}
                    onClick={() => navigate(`/study/${course.id}/${topic.id}`)}
                    className="bg-white dark:bg-slate-800/50 rounded-[24px] overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700/50 cursor-pointer flex flex-col hover:shadow-md hover:scale-[1.01] transition-all duration-300"
                  >
                    <div className="h-[130px] sm:h-[150px] bg-slate-100 dark:bg-slate-900 relative overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/course-${course.id}/600/300`} 
                        alt={course.title} 
                        className="w-full h-full object-cover opacity-90 hover:scale-105 transition-transform duration-500" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                      <div>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-extrabold tracking-wider uppercase mb-1.5 line-clamp-1">{course.title}</p>
                        <h4 className="text-sm sm:text-base font-bold leading-snug line-clamp-2 text-slate-900 dark:text-white">{topic.title}</h4>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full h-[140px] bg-white dark:bg-slate-800/30 rounded-[24px] border border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center text-slate-400 text-sm font-medium">
                No recent topics found inside your registered curriculum.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
