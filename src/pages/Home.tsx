import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Book, Zap, Clock, Trophy, ChevronRight, BarChart2, MessageSquare, BookOpen, Crown } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, limit, getDocs, getDoc, doc, orderBy, onSnapshot } from 'firebase/firestore';
import { isPolytechnic } from '../lib/constants';
import ThemeToggle from '../components/ThemeToggle';
import type { Course, Topic } from '../types';
import LoadingScreen, { LoadingSpinner } from '../components/LoadingScreen';

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const root = 'courses';
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [totalAvailableCourses, setTotalAvailableCourses] = useState<number>(0);
  const [continueLearning, setContinueLearning] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    if (recentCourses.length === 0) {
      setLoading(true);
    }

    const qRecent = query(
      collection(db, `users/${user.id}/recent_views`),
      orderBy('lastViewedAt', 'desc'),
      limit(5)
    );

    const qCourses = query(collection(db, root));

    let coursesUnsub = () => {};
    let continueLearningUnsub = () => {};

    try {
      coursesUnsub = onSnapshot(qCourses, (coursesSnapshot) => {
        let coursesData: Course[] = coursesSnapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          ...docSnapshot.data()
        } as Course));

        const departments = [user?.department, 'General'].filter((v, i, a) => v && a.indexOf(v) === i);
        const isPoly = isPolytechnic(user?.school || '');
        
        let activeSchool = user?.school;
        const hasSpecificSchoolCourses = coursesData.some(c => c.school === user?.school);
        if (!hasSpecificSchoolCourses) {
          activeSchool = isPoly ? 'Auchi Polytechnic' : 'University of Benin (UNIBEN)';
        }

        coursesData = coursesData.filter(c => {
          const schoolMatch =
            c.school === activeSchool ||
            (isPoly && c.school === 'NBTE') ||
            (!isPoly && c.school === 'CCMAS');
          return (
            schoolMatch &&
            departments.includes(c.department) &&
            (c.level?.replace(/\s+/g, '') === user?.level?.replace(/\s+/g, '') ||
              c.level === 'All Levels' ||
              !c.level)
          );
        });
        
        setTotalAvailableCourses(coursesData.length);
        setRecentCourses(coursesData.slice(0, 10));
        setLoading(false);
      }, (error) => {
        console.error("Courses snapshot error", error);
        setLoading(false);
      });

      continueLearningUnsub = onSnapshot(qRecent, async (recentViewsSnapshot) => {
        const continueLearningPromises = recentViewsSnapshot.docs.map(async (viewDoc) => {
          const viewData = viewDoc.data();
          const courseRef = doc(db, root, viewData.courseId);
          const courseDoc = await getDoc(courseRef);
          
          if (courseDoc.exists()) {
            const course = { id: courseDoc.id, ...courseDoc.data() } as Course;
            const topicsSnapshot = await getDocs(query(collection(db, `${root}/${course.id}/topics`), limit(1)));
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
      }, (error) => {
        console.error("Recent views snapshot error", error);
      });

    } catch (error) {
      console.error("Error setting up snapshots:", error);
      setLoading(false);
    }

    return () => {
      coursesUnsub();
      continueLearningUnsub();
    };
  }, [user?.id, user?.school, user?.department, user?.level]);



  return (
    <div className="space-y-6 pb-6 pt-2 max-w-2xl mx-auto w-full">
      
      {/* Header Greeting */}
      <div className="px-1 pt-2 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-surface border border-border flex-shrink-0 relative">
             {user?.avatar_url ? (
               <img src={user.avatar_url} alt={user.full_name || 'Profile'} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-xl bg-primary/10 text-primary font-bold">
                  {user?.full_name?.charAt(0) || 'M'}
               </div>
             )}
          </div>
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-text leading-tight">
              Hi, {user?.full_name?.split(' ')[0] || 'Michael'}
            </h1>
            <p className="text-sm font-medium text-muted">
              Welcome Back
            </p>
          </div>
        </div>
        
        <ThemeToggle />
      </div>

      {/* Daily Streak Banner */}
      <div 
        onClick={() => navigate('/profile')}
        className="cursor-pointer group lg:mb-8"
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">🔥</span>
            <h3 className="font-bold text-text text-sm tracking-tight">Daily Streak</h3>
          </div>
          <span className="text-[11px] font-black text-slate-800 dark:text-white bg-slate-100 dark:bg-white/10 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/20 tracking-widest uppercase">
            {user?.streak || 0} days
          </span>
        </div>

        <div className="bg-slate-100/80 dark:bg-slate-800/50 rounded-[28px] p-2.5 sm:p-3 flex justify-between items-center gap-1.5 sm:gap-2 shadow-sm border border-slate-200/50 dark:border-slate-700/50 relative">
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

            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayDate = date.getDate();

            return (
              <div 
                key={i} 
                className={`flex-1 flex flex-col items-center justify-between py-2 sm:py-2.5 rounded-[100px] relative transition-all duration-300 ${
                  isCompleted 
                    ? "bg-[#FDF3C7] dark:bg-yellow-900/40 border-b-2 border-r-2 border-[#F3E29F] dark:border-yellow-700/50 shadow-sm z-10" 
                    : "bg-white dark:bg-slate-800 border-b border-r border-[#E2E8F0] dark:border-slate-700/50"
                } ${isToday ? 'scale-105 z-20' : ''}`}
                style={{ minHeight: '84px' }}
              >
                <span className={`text-[11px] sm:text-xs font-semibold mt-1 ${isCompleted ? 'text-slate-800 dark:text-yellow-100' : 'text-slate-600 dark:text-slate-400'}`}>
                  {dayName}
                </span>

                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-[13px] sm:text-sm ${
                  isCompleted 
                    ? "bg-white dark:bg-yellow-800 text-slate-900 dark:text-white mb-0.5 shadow-sm" 
                    : "text-slate-800 dark:text-white"
                }`}>
                  {dayDate}
                </div>

                {isCompleted && (
                  <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#0F172A] dark:bg-slate-100 rounded-full flex items-center justify-center border-2 border-[#FDF3C7] dark:border-yellow-900/40 z-30 shadow-sm`}>
                    <svg className="w-2.5 h-2.5 text-white dark:text-slate-900 stroke-[4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Action Bento Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* My Courses Card */}
        <div onClick={() => navigate('/library')} className="bg-[#F0F5FF] dark:bg-blue-900/40 border border-blue-100 dark:border-blue-500/20 rounded-[24px] p-5 relative overflow-hidden cursor-pointer shadow-sm min-h-[160px] flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <p className="text-[10px] font-black tracking-wider text-blue-600 dark:text-blue-300 uppercase mb-1.5">{totalAvailableCourses} available</p>
            <h3 className="text-xl font-black leading-tight text-[#1E2E5B] dark:text-blue-50 tracking-tight group-hover:translate-x-1 transition-transform">My Courses</h3>
          </div>
          <BookOpen size={72} strokeWidth={1.5} className="absolute -bottom-1 -right-1 text-blue-400/20 dark:text-blue-400/20 group-hover:scale-110 transition-transform duration-500 opacity-90" />
        </div>

        {/* Premium & Plan Card */}
        <div onClick={() => navigate('/billing')} className="bg-[#FFF8F0] dark:bg-amber-900/40 border border-orange-100 dark:border-amber-500/20 rounded-[24px] p-5 relative overflow-hidden cursor-pointer shadow-sm min-h-[160px] flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <p className="text-[10px] font-black text-orange-600 dark:text-amber-400 uppercase tracking-wider mb-1.5 font-bold">Manage & Upgrade</p>
            <h3 className="text-xl font-black leading-tight text-[#5C2E00] dark:text-amber-100 tracking-tight group-hover:translate-x-1 transition-transform">Go Premium</h3>
          </div>
          <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-orange-100/30 dark:bg-amber-500/10 rounded-full blur-2xl group-hover:bg-orange-200/50 dark:group-hover:bg-amber-500/20 transition-colors"></div>
          <Crown size={72} strokeWidth={1.2} className="absolute bottom-1 right-1 text-orange-400/20 dark:text-amber-400/20 group-hover:scale-110 transition-transform duration-500 opacity-90 rotate-12" />
        </div>

        {/* AI Chat Card */}
        <div 
          onClick={() => navigate('/chat')}
          className="bg-[#F5F3FF] dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-500/20 rounded-[24px] p-5 relative overflow-hidden cursor-pointer shadow-sm min-h-[160px] flex flex-col justify-between group hover:shadow-md transition-shadow"
        >
          <div className="relative z-10">
            <p className="text-[10px] font-black tracking-wider text-indigo-600 dark:text-indigo-300 uppercase mb-1.5">Ask questions</p>
            <h3 className="text-xl font-black leading-tight text-[#281E5B] dark:text-indigo-50 tracking-tight group-hover:translate-x-1 transition-transform">AI Chat</h3>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] w-24 h-24 flex items-center justify-center text-indigo-400/20 dark:text-indigo-400/20 group-hover:text-indigo-400/30 transition-colors">
            <MessageSquare size={80} strokeWidth={1} />
          </div>
        </div>

        {/* Analytics Card */}
        <div onClick={() => navigate('/analytics')} className="bg-[#F0FDFA] dark:bg-teal-900/40 border border-teal-100 dark:border-teal-500/20 rounded-[24px] p-5 relative overflow-hidden cursor-pointer shadow-sm min-h-[160px] flex flex-col justify-between group hover:shadow-md transition-shadow">
          <div className="relative z-10">
            <p className="text-[10px] font-black tracking-wider text-teal-600 dark:text-teal-300 uppercase mb-1.5">Track your</p>
            <h3 className="text-xl font-black leading-tight text-[#0B3A2C] dark:text-teal-50 tracking-tight group-hover:translate-x-1 transition-transform">Analytics</h3>
          </div>
          <BarChart2 size={72} strokeWidth={1.5} className="absolute -bottom-1 -right-1 text-teal-400/20 dark:text-teal-400/20 group-hover:scale-110 transition-transform duration-500 opacity-90" />
        </div>
      </div>

      {/* Enrolled Courses Row */}
      <div 
        onClick={() => navigate('/library')}
        className="bg-surface rounded-[20px] p-4 flex items-center gap-4 shadow-sm border border-border cursor-pointer group hover:border-primary/30"
      >
        <div className="w-12 h-12 bg-background border border-border rounded-xl flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105 group-hover:shadow-[0_0_10px_rgba(var(--primary),0.2)]">
          <img 
            src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=100&h=100" 
            alt="Courses" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-sm">Your enrolled courses</h4>
          <p className="text-[11px] text-muted font-medium mt-0.5">Total {totalAvailableCourses} courses</p>
        </div>
        <ChevronRight size={20} className="text-muted group-hover:text-primary transition-transform" />
      </div>

      {/* Horizontal Scroll Section: Free Animated Lesson */}
      <section className="space-y-3">
        <h3 className="font-bold text-sm px-1">Continue Learning</h3>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-1">
           {loading ? (
             <>
               <div className="min-w-[200px] h-[180px] bg-surface rounded-[24px] animate-pulse snap-start"></div>
               <div className="min-w-[200px] h-[180px] bg-surface rounded-[24px] animate-pulse snap-start"></div>
             </>
           ) : continueLearning.length > 0 ? (
             continueLearning.map((course, idx) => {
               const topic = course.topics?.[0]; // Show the first topic or just the course
               if (!topic) return null;
               return (
                   <div 
                   key={`${course.id}-${topic.id}`}
                   onClick={() => navigate(`/study/${course.id}/${topic.id}`)}
                   className="min-w-[240px] bg-surface rounded-[24px] overflow-hidden shadow-sm border border-border cursor-pointer snap-start flex flex-col group hover:border-primary/30"
                 >
                    {/* Top half - AI Illustration or abstract background */}
                    <div className="h-[120px] bg-background border-b border-border flex items-center justify-center relative overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/course-${course.id}/600/400`} 
                        alt={course.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-90" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent"></div>
                    </div>
                   {/* Bottom half - Content focus */}
                   <div className="p-4 flex-1 flex flex-col">
                     <div className="flex items-center gap-1.5 mb-2">
                       <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                       <p className="text-[11px] text-muted font-bold tracking-wide">{course.title}</p>
                     </div>
                     <h4 className="text-sm font-bold leading-tight">{topic.title}</h4>
                   </div>
                 </div>
               );
             })
           ) : (
             <div className="min-w-[240px] h-[180px] bg-surface rounded-[24px] p-6 text-center border-dashed border-2 border-border text-muted text-sm flex items-center justify-center flex-col">
               <BookOpen size={32} className="mb-2 opacity-50" />
               <p className="font-bold">No progress yet</p>
               <p className="text-[10px] mt-1">Courses you view will appear here.</p>
             </div>
           )}
        </div>
      </section>

      {/* Section: Available Courses */}
      <section className="space-y-3 pb-8">
        <h3 className="font-bold text-sm px-1">My Courses</h3>
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-1">
           {loading ? (
              <>
               <div className="min-w-[220px] h-[200px] bg-surface rounded-[24px] animate-pulse snap-start"></div>
               <div className="min-w-[220px] h-[200px] bg-surface rounded-[24px] animate-pulse snap-start"></div>
             </>
           ) : recentCourses.length > 0 ? (
             recentCourses.map(course => (
                 <div 
                   key={course.id}
                   onClick={() => navigate('/library')}
                   className="min-w-[240px] bg-surface rounded-[24px] overflow-hidden shadow-sm border border-border cursor-pointer snap-start flex flex-col group hover:border-primary/30"
                 >
                   <div className="h-[100px] bg-background border-b border-border flex items-center justify-center relative overflow-hidden text-muted/30">
                       <img 
                         src={`https://picsum.photos/seed/thumb-${course.id}/400/300`} 
                         alt={course.title} 
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter grayscale group-hover:grayscale-0 opacity-60 group-hover:opacity-100" 
                         referrerPolicy="no-referrer"
                       />
                       <div className="absolute inset-0 bg-black/5"></div>
                   </div>
                   <div className="p-4 flex-1 flex flex-col justify-center">
                     <h4 className="text-sm font-bold leading-tight line-clamp-1 mb-1.5">{course.title}</h4>
                     <p className="text-[11px] text-muted font-medium flex items-center gap-1">
                        For {user?.level} <span className="text-border">|</span> <span className="text-muted font-bold">{course.code}</span>
                     </p>
                   </div>
                 </div>
             ))
           ) : (
             <div className="min-w-[240px] h-[200px] bg-surface rounded-[24px] p-6 text-center border-dashed border-2 border-border text-muted text-sm flex flex-col items-center justify-center">
               <Book size={32} className="mb-2 opacity-50" />
               No courses available for your department yet.
             </div>
           )}
        </div>
      </section>

    </div>
  );
}
