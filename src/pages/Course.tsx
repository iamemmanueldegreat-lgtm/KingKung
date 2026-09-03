import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import type { Course as CourseType, Topic } from '../types';
import { ArrowLeft, Star, Layers, Award, BookOpen, Calendar, CheckCircle2, Check, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { LoadingSpinner } from '../components/LoadingScreen';
import { isTopicRead, getReadTopicsLocal } from '../lib/readProgress';

const COURSE_THEMES = [
  { bg: 'bg-[#FFE299]', starColor: 'text-amber-500', doodleColor: 'stroke-amber-500/20' },
  { bg: 'bg-[#C1EAD9]', starColor: 'text-emerald-500', doodleColor: 'stroke-emerald-500/20' },
  { bg: 'bg-[#DCD0FF]', starColor: 'text-indigo-500', doodleColor: 'stroke-indigo-500/20' },
  { bg: 'bg-[#FFC6D9]', starColor: 'text-rose-500', doodleColor: 'stroke-rose-500/20' }
];

const CHAPTER_STAMPS = [Layers, Award, BookOpen, Calendar];

// Memory caches across SPA transitions to make navigating to courses/chapters instant
const cachedCourseDetails: Record<string, { course: CourseType; topics: Topic[] }> = {};

export default function Course() {
  const { courseId } = useParams();
  const root = 'courses';
  const navigate = useNavigate();
  const [openLessonIndex, setOpenLessonIndex] = useState<number | null>(null);
  const [readTopics, setReadTopics] = useState<string[]>(getReadTopicsLocal());

  useEffect(() => {
    const handleUpdate = () => setReadTopics(getReadTopicsLocal());
    window.addEventListener('read_topics_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('read_topics_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);
  
  // Try to load cached data synchronously
  const cachedData = useMemo(() => {
    if (!courseId) return null;
    if (cachedCourseDetails[courseId]) {
      return cachedCourseDetails[courseId];
    }
    try {
      const stored = localStorage.getItem(`course_detail_${courseId}`);
      if (stored) {
        const parsed = JSON.parse(stored) as { course: CourseType; topics: Topic[] };
        if (parsed && parsed.course) {
          cachedCourseDetails[courseId] = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached details', e);
    }
    return null;
  }, [courseId]);

  const [course, setCourse] = useState<CourseType | null>(cachedData?.course || null);
  const [topics, setTopics] = useState<Topic[]>(cachedData?.topics || []);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    setCourse(cachedData?.course || null);
    setTopics(cachedData?.topics || []);
    setLoading(!cachedData);
  }, [courseId, cachedData]);

  useEffect(() => {
    async function loadCourse() {
      if (!courseId) return;
      const hasCached = !!cachedData || !!cachedCourseDetails[courseId];
      if (!hasCached) {
        setLoading(true);
      }
      try {
        const courseDoc = await getDoc(doc(db, root, courseId));
        let cData: CourseType | null = null;
        if (courseDoc.exists()) {
          cData = courseDoc.data() as CourseType;
          cData.id = courseDoc.id;
          setCourse(cData);
        }
        
        const topicsSnapshot = await getDocs(
          collection(db, `${root}/${courseId}/topics`)
        );
        const topicsData: Topic[] = topicsSnapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        topicsData.sort((a, b) => {
          const ca = a.chapter_order ?? 999;
          const cb = b.chapter_order ?? 999;
          if (ca !== cb) return ca - cb;
          return (a.order ?? 0) - (b.order ?? 0);
        });
        setTopics(topicsData);

        if (cData) {
          const payload = { course: cData, topics: topicsData };
          cachedCourseDetails[courseId] = payload;
          try {
            localStorage.setItem(`course_detail_${courseId}`, JSON.stringify(payload));
          } catch (e) {
            console.warn('Storage quota limit reached', e);
          }
        }
      } catch (error) {
        if (hasCached) {
          console.warn('Failed to refresh course details in background, using cache', error);
        } else {
          try {
            handleFirestoreError(error, OperationType.GET, root + '/' + courseId);
          } catch(e) {}
        }
      } finally {
        setLoading(false);
      }
    }
    loadCourse();
  }, [courseId]);

  const [searchParams] = useSearchParams();
  const chapterQuery = searchParams.get('chapter');

  // Group topics by chapter name
  const groupedChapters = useMemo(() => {
    const groups: { chapter: string; chapter_order: number; topics: Topic[] }[] = [];
    for (const t of topics) {
      const name = t.chapter || 'Foundations';
      const order = t.chapter_order ?? 999;
      
      // If a 'chapter' query param is present, only include topics for that chapter
      if (chapterQuery && name !== chapterQuery) {
        continue;
      }
      
      let g = groups.find(x => x.chapter === name);
      if (!g) {
        g = { chapter: name, chapter_order: order, topics: [] };
        groups.push(g);
      }
      g.topics.push(t);
    }
    return groups;
  }, [topics, chapterQuery]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0e0e12] text-zinc-900 dark:text-zinc-100 font-sans selection:bg-[#7C3AED]/10 pb-12">
      {/* Navbar Minimal */}
      <header className="sticky top-0 z-40 bg-neutral-50/90 dark:bg-[#0e0e12]/90 backdrop-blur-md pt-5 pb-4 px-5 sm:px-6 flex items-center justify-between">
        <button 
          onClick={() => {
            if (chapterQuery) {
              navigate(`/course/${courseId}`);
            } else {
              navigate('/library');
            }
          }}
          className="text-zinc-800 dark:text-zinc-200 hover:opacity-70 transition-opacity flex items-center gap-1 font-semibold text-xs"
        >
          <ArrowLeft size={20} strokeWidth={2} />
          <span>{chapterQuery ? "All Lessons" : "Library"}</span>
        </button>
        <span className="font-bold text-[17px] tracking-tight text-zinc-900 dark:text-zinc-100">{chapterQuery ? "Lesson Topics" : "Textbook"}</span>
        <div className="w-6"></div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl mx-auto px-5 sm:px-6">
        {loading ? (
          <div className="py-32 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="space-y-8 mt-2">
            
            {/* Header Section (Book Info) */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1 sm:space-y-1.5 flex-1 pt-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                  {chapterQuery ? chapterQuery : (course?.title || 'Untitled Course')}
                </h1>
                {course && <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">{course?.department || 'General'}</p>}
                {course && <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Code: {course?.code || 'N/A'}</p>}
                {course && <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">{course?.school || 'University'}</p>}
                
                {chapterQuery && (
                  <button
                    onClick={() => navigate(`/course/${courseId}`)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline pt-2"
                  >
                    ← Back to all lessons in {course?.code || 'Course'}
                  </button>
                )}
              </div>

              {/* Cover Image Placeholder */}
              <div className="w-20 h-28 sm:w-24 sm:h-32 bg-[#F3E5D8] rounded-md shadow-sm border border-black/5 overflow-hidden flex flex-col shrink-0 relative mt-1">
                 <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-[#E7D0BB] to-transparent opacity-50"></div>
                 <div className="relative z-10 flex-1 p-2.5 flex flex-col">
                    <span className="text-[10px] font-black text-amber-900/80 leading-none uppercase tracking-tighter">
                      {course?.title?.substring(0, 20) || 'COURSE'}
                    </span>
                    <span className="text-[6px] font-bold text-amber-900/60 leading-none uppercase tracking-tighter mt-0.5 max-w-full truncate">
                      {course?.code || 'CODE'}
                    </span>
                 </div>
                 <div className="relative z-10 h-8 mt-auto flex">
                    <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=200')] bg-cover bg-center mix-blend-multiply opacity-50"></div>
                 </div>
              </div>
            </div>

            {/* Direct Topic List view when chapterQuery is active */}
            {chapterQuery && groupedChapters[0] && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] sm:text-[21px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    Topics under this Lesson ({groupedChapters[0].topics.filter(t => t.title && t.title.trim() !== '---').length})
                  </h2>
                </div>

                <div className="space-y-2.5">
                  {groupedChapters[0].topics
                    .filter(t => t.title && t.title.trim() !== '---')
                    .map((topic, tIdx) => {
                      const read = isTopicRead(topic.id, readTopics);
                      return (
                        <button
                          key={`c-topic-1-${topic.id}-${tIdx}`}
                          onClick={() => navigate(`/study/${courseId}/${topic.id}`)}
                          className={`w-full group flex items-center justify-between p-4 rounded-2xl border text-left transition-all active:scale-[0.98] ${
                            read
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100/50'
                              : 'bg-white dark:bg-zinc-900/90 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200/80 dark:border-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 pr-2">
                            {read ? (
                              <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center justify-center shrink-0 border border-emerald-300/60 dark:border-emerald-800">
                                <Check size={16} className="stroke-[3]" />
                              </span>
                            ) : (
                              <span className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-black flex items-center justify-center shrink-0 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60">
                                {tIdx + 1}
                              </span>
                            )}
                            <div>
                              <span className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors line-clamp-2">
                                {topic.title}
                              </span>
                            </div>
                          </div>

                          {read ? (
                            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-100/80 dark:bg-emerald-950/80 px-3.5 py-1.5 rounded-xl border border-emerald-300/60 dark:border-emerald-800/60 shadow-sm flex items-center gap-1.5">
                              <CheckCircle2 size={13} className="text-emerald-500 stroke-[3]" />
                              Read
                            </span>
                          ) : (
                            <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 shrink-0 bg-zinc-100 dark:bg-zinc-800 px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm group-hover:bg-zinc-900 group-hover:text-white dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900 transition-all">
                              Study →
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Lessons List Grid (when browsing all lessons) */}
            {!chapterQuery && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[19px] sm:text-[21px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {groupedChapters.length} Lessons
                  </h2>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {topics.length} total topics
                  </span>
                </div>
                
                {groupedChapters.length === 0 ? (
                  <div className="text-center py-16 px-6">
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium">No lessons available yet for this course.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-min mt-2">
                    {groupedChapters.map((group, chapterIdx) => {
                      const visibleTopics = group.topics.filter(t => t.title && t.title.trim() !== '---');
                      if (visibleTopics.length === 0) return null;

                      const theme = COURSE_THEMES[chapterIdx % COURSE_THEMES.length];
                      const StampIcon = CHAPTER_STAMPS[chapterIdx % CHAPTER_STAMPS.length];

                      return (
                        <motion.div
                          key={group.chapter}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: chapterIdx * 0.04 }}
                          onClick={() => setOpenLessonIndex(chapterIdx)}
                          className={`relative cursor-pointer group h-52 sm:h-60 p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] flex flex-col justify-between overflow-hidden border border-black/5 dark:border-none shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ${theme.bg}`}
                        >
                          <div className="absolute inset-x-4 top-4 bottom-16 opacity-30 pointer-events-none">
                            <svg className="w-full h-full" viewBox="0 0 100 135" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M 20,25 C 60,15 75,35 45,55 C 15,75 80,75 50,105" className={theme.doodleColor} />
                            </svg>
                          </div>

                          {/* Top Bar */}
                          <div className="flex justify-between items-center w-full relative z-10">
                            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
                              <Star className={`w-4 h-4 ${theme.starColor} fill-current`} />
                            </div>
                            <span className="text-[11px] sm:text-[12px] font-extrabold tracking-widest uppercase font-mono bg-white/70 text-black px-3 py-1 rounded-[10px] shadow-sm border border-black/5">
                              LESSON {chapterIdx + 1}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="space-y-1 sm:space-y-2 relative z-10 flex-1 flex flex-col justify-center items-center text-center select-none py-2">
                            <h3 className="text-base sm:text-xl font-black text-black leading-snug font-sans tracking-tight line-clamp-3 text-center transition-colors">
                              {group.chapter}
                            </h3>
                          </div>

                          {/* Bottom Bar */}
                          <div className="flex items-center border-t border-black/5 pt-1.5 sm:pt-2 relative z-10 mt-auto justify-between">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/5 flex items-center justify-center text-[#111827]/70">
                              <StampIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            </div>
                            <span className="text-[11px] sm:text-xs font-bold text-neutral-800 group-hover:underline">
                              {visibleTopics.length} {visibleTopics.length === 1 ? 'Topic' : 'Topics'} →
                            </span>
                          </div>

                          {/* Side Notch Decoration */}
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-10 sm:h-12 pointer-events-none z-10 opacity-70">
                            <svg className="absolute inset-0 w-full h-full text-white dark:text-[#0B0F19] fill-current" viewBox="0 0 32 80" preserveAspectRatio="none">
                              <path d="M 32,0 C 32,18 14,18 14,40 C 14,62 32,62 32,80 Z" />
                            </svg>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Lesson Modal Drawer for selected lesson in Course page */}
            {openLessonIndex !== null && groupedChapters[openLessonIndex] && (
              <div 
                className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200"
                onClick={() => setOpenLessonIndex(null)}
              >
                <motion.div
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-[#15151f] w-full rounded-t-[32px] sm:rounded-t-[40px] p-6 sm:p-8 border-t border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[88vh] flex flex-col justify-between"
                >
                  {/* Drawer Handle Notch */}
                  <div className="w-12 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mb-4 shrink-0"></div>

                  <div className="flex items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4 shrink-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                          Lesson {openLessonIndex + 1}
                        </span>
                        <span className="text-xs font-semibold text-zinc-400">
                          {groupedChapters[openLessonIndex].topics.filter(t => t.title && t.title.trim() !== '---').length} topics
                        </span>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-tight mt-1">
                        {groupedChapters[openLessonIndex].chapter}
                      </h3>
                    </div>
                    <button
                      onClick={() => setOpenLessonIndex(null)}
                      className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center text-sm font-bold shrink-0 transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 overflow-y-auto custom-scrollbar my-4 pr-1 flex-1">
                    <p className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      Topics under this lesson:
                    </p>

                    <div className="space-y-2.5">
                      {groupedChapters[openLessonIndex].topics
                        .filter(t => t.title && t.title.trim() !== '---')
                        .map((topic, tIdx) => {
                          const read = isTopicRead(topic.id, readTopics);
                          return (
                            <div
                              key={`c-topic-2-${topic.id}-${tIdx}`}
                              onClick={() => {
                                setOpenLessonIndex(null);
                                navigate(`/study/${courseId}/${topic.id}`);
                              }}
                              className={`w-full group flex items-center justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
                                read
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/40 hover:bg-emerald-100/50'
                                  : 'bg-zinc-50 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200/80 dark:border-zinc-800/80'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                                {read ? (
                                  <span className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center justify-center shrink-0 border border-emerald-300/60 dark:border-emerald-800">
                                    <Check size={16} className="stroke-[3]" />
                                  </span>
                                ) : (
                                  <span className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-black flex items-center justify-center shrink-0 shadow-sm border border-zinc-200/60 dark:border-zinc-700/60">
                                    {tIdx + 1}
                                  </span>
                                )}
                                <span className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors line-clamp-2">
                                  {topic.title}
                                </span>
                              </div>
                              {read && (
                                <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-100/80 dark:bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-300/60 dark:border-emerald-800/60 shadow-sm flex items-center gap-1">
                                  <CheckCircle2 size={13} className="text-emerald-500 stroke-[3]" />
                                  Done
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Single Start Reading Button at Bottom */}
                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 shrink-0">
                    <button
                      onClick={() => {
                        const currentGroup = groupedChapters[openLessonIndex];
                        const visibleTopics = currentGroup.topics.filter(t => t.title && t.title.trim() !== '---');
                        const nextTopic = visibleTopics.find(t => !isTopicRead(t.id, readTopics)) || visibleTopics[0];
                        setOpenLessonIndex(null);
                        if (nextTopic) {
                          navigate(`/study/${courseId}/${nextTopic.id}`);
                        }
                      }}
                      className="w-full py-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-extrabold text-base shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Start Reading</span>
                      <ArrowRight size={18} className="stroke-[3]" />
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

