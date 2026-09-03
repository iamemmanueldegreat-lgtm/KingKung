import { useState, useEffect } from 'react';
import { Search, Star, BookOpen, Layers, Award, Calendar, GraduationCap, Library as LibraryIcon, CheckCircle2, Check, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import type { Course, Topic } from '../types';
import { LoadingSpinner } from '../components/LoadingScreen';
import { isPolytechnic } from '../lib/constants';
import { isTopicRead, getReadTopicsLocal } from '../lib/readProgress';

const COURSE_THEMES = [
  { bg: 'bg-[#FFECAA]', starColor: 'text-[#E8590C]', doodleColor: 'stroke-[#E8590C]/10' },
  { bg: 'bg-[#D1EBE3]', starColor: 'text-[#099268]', doodleColor: 'stroke-[#099268]/10' },
  { bg: 'bg-[#E5D4F5]', starColor: 'text-[#7048E8]', doodleColor: 'stroke-[#7048E8]/10' },
  { bg: 'bg-[#FFD1DF]', starColor: 'text-[#D6336C]', doodleColor: 'stroke-[#D6336C]/10' },
];
const CHAPTER_STAMPS = [Layers, Award, BookOpen, Calendar];

// In-memory cache keyed by user+dept+level+semester
const globalCoursesCache: Record<string, Course[]> = {};

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userSemester = user?.semester || 1;
  const [semester, setSemester] = useState<1 | 2>(userSemester);

  useEffect(() => {
    if (user?.semester) {
      setSemester(user.semester);
    }
  }, [user?.semester]);

  const cacheKey = `${user?.id}-${user?.department}-${user?.level}-${semester}`;

  // Try loading from memory or localStorage synchronously
  const initialCourses = () => {
    if (globalCoursesCache[cacheKey]) return globalCoursesCache[cacheKey];
    try {
      const stored = localStorage.getItem(`library_courses_${cacheKey}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          globalCoursesCache[cacheKey] = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse cached library courses', e);
    }
    return [];
  };

  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [loading, setLoading] = useState<boolean>(() => courses.length === 0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
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

  const isPoly = isPolytechnic(user?.school || '');

  useEffect(() => {
    // Reset selected course when semester changes
    setSelectedCourseId(null);
  }, [semester]);

  useEffect(() => {
    if (!user) return;

    // Check memory or localStorage cache first
    const cached = globalCoursesCache[cacheKey] || (() => {
      try {
        const stored = localStorage.getItem(`library_courses_${cacheKey}`);
        return stored ? JSON.parse(stored) : null;
      } catch (e) {
        return null;
      }
    })();

    if (cached && cached.length > 0) {
      setCourses(cached);
      setLoading(false);
      // Background silent refresh
      fetchCoursesFromDb(false);
    } else {
      fetchCoursesFromDb(true);
    }
  }, [user?.id, user?.department, user?.level, semester]);

  const fetchCoursesFromDb = async (showLoading = true) => {
    if (showLoading && courses.length === 0) setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'courses'));
      let all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Course));

      // Try to find courses for the user's specific school
      let activeSchool = user?.school;
      const hasSpecificSchoolCourses = all.some(c => c.school === user?.school);
      if (!hasSpecificSchoolCourses) {
        activeSchool = isPoly ? 'Auchi Polytechnic' : 'University of Benin (UNIBEN)';
      }

      all = all.filter(c => {
        const deptMatch = c.department === user?.department || c.department === 'General';
        const levelMatch =
          c.level?.replace(/\s+/g, '') === user?.level?.replace(/\s+/g, '') ||
          c.level === 'All Levels' ||
          !c.level;
        const schoolMatch =
          c.school === activeSchool ||
          (isPoly && c.school === 'NBTE') ||
          (!isPoly && c.school === 'CCMAS');
        const semesterMatch = !c.semester || c.semester === semester;
        return deptMatch && levelMatch && schoolMatch && semesterMatch;
      });

      // Instantly display filtered courses if we don't have cached data yet
      if (all.length > 0) {
        setCourses(prev => {
          // Merge preserving topics if already loaded
          return all.map(course => {
            const existing = prev.find(p => p.id === course.id);
            if (existing && existing.topics) {
              course.topics = existing.topics;
            }
            return course;
          });
        });
        setLoading(false);
      }

      // Fetch topics for each course in parallel without blocking initial display
      const withTopics = await Promise.all(
        all.map(async (course) => {
          try {
            const topicsSnap = await getDocs(collection(db, `courses/${course.id}/topics`));
            course.topics = topicsSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as Topic))
              .sort((a, b) => ((a.chapter_order ?? 0) * 1000 + (a.order ?? 0)) - ((b.chapter_order ?? 0) * 1000 + (b.order ?? 0)));
            
            // Also update course_detail cache for instant course page loading
            const detailKey = `course_detail_${course.id}`;
            localStorage.setItem(detailKey, JSON.stringify({ course, topics: course.topics }));
          } catch (tErr) {
            console.warn(`Could not load topics for course ${course.id}`, tErr);
          }
          return course;
        })
      );

      globalCoursesCache[cacheKey] = withTopics;
      localStorage.setItem(`library_courses_${cacheKey}`, JSON.stringify(withTopics));
      setCourses(withTopics);
    } catch (e) {
      console.error('Error fetching courses:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(
    c =>
      c.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-5 w-full max-w-4xl mx-auto pb-16 px-3.5 pt-1 sm:pt-2">
      {/* Header & Inline Search Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black font-sans tracking-tight text-neutral-900 dark:text-neutral-50 animate-fade-in truncate">
              Your Library
            </h1>
            <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 mt-0.5 truncate">
              {user?.department} &middot; {user?.level} &middot;{' '}
              {semester === 1 ? '1st Semester' : '2nd Semester'}
            </p>
          </div>

          {/* Library Icon opposite to Your Library title */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-[18px] bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center shrink-0 shadow-sm border border-zinc-200 dark:border-zinc-700">
            <LibraryIcon size={22} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Permanent Inline Search Bar */}
        <div className="relative w-full">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search courses or topics..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-10 sm:h-11 pl-10 pr-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 dark:focus:border-zinc-100 dark:focus:ring-zinc-100 transition-all text-xs font-semibold shadow-sm text-zinc-900 dark:text-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Course code pills — list view */}
      {courses.length > 0 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 -mx-1.5 px-1.5 whitespace-nowrap scroll-smooth">
          {courses.map((course, idx) => {
            const isSelected = selectedCourseId === course.id;
            return (
              <button
                key={`lib-pill-${course.id}-${idx}`}
                onClick={() => setSelectedCourseId(isSelected ? null : course.id)}
                className={`px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl text-xs sm:text-sm font-black tracking-wide uppercase whitespace-nowrap transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100 shadow-md scale-[1.02]'
                    : 'bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:scale-[1.01]'
                }`}
              >
                #{course.code.toUpperCase()}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-24 flex items-center justify-center w-full">
          <LoadingSpinner />
        </div>
      ) : selectedCourseId ? (
        /* Selected Course Lessons View */
        (() => {
          const selCourse = courses.find(c => c.id === selectedCourseId);
          if (!selCourse) return null;

          // Group topics by lesson (chapter)
          const lessonGroups: { name: string; order: number; topics: Topic[] }[] = [];
          if (selCourse.topics) {
            for (const t of selCourse.topics) {
              if (!t.title || t.title.trim() === '---') continue;
              const lessonName = t.chapter || 'Lesson 1: Overview & Fundamentals';
              const lessonOrder = t.chapter_order ?? 1;

              let g = lessonGroups.find(x => x.name === lessonName);
              if (!g) {
                g = { name: lessonName, order: lessonOrder, topics: [] };
                lessonGroups.push(g);
              }
              g.topics.push(t);
            }
          }
          lessonGroups.sort((a, b) => a.order - b.order);

          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 pt-1 pb-12"
            >
              {/* Textbook Header Section (Identical to Course page design) */}
              <div className="flex justify-between items-start gap-4 bg-white dark:bg-[#1a1a24] p-5 sm:p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
                <div className="space-y-1 sm:space-y-1.5 flex-1 pt-1">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                    {selCourse.title}
                  </h1>
                  <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-300">
                    {selCourse.department || user?.department || 'General'}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    Code: {selCourse.code?.toUpperCase() || 'N/A'}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                    {selCourse.school || user?.school || 'University'}
                  </p>
                </div>

                {/* Cover Image Placeholder */}
                <div className="w-20 h-28 sm:w-24 sm:h-32 bg-[#F3E5D8] rounded-md shadow-sm border border-black/5 overflow-hidden flex flex-col shrink-0 relative mt-1">
                   <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-[#E7D0BB] to-transparent opacity-50"></div>
                   <div className="relative z-10 flex-1 p-2.5 flex flex-col">
                      <span className="text-[10px] font-black text-amber-900/80 leading-none uppercase tracking-tighter">
                        {selCourse.title?.substring(0, 20) || 'COURSE'}
                      </span>
                      <span className="text-[6px] font-bold text-amber-900/60 leading-none uppercase tracking-tighter mt-0.5 max-w-full truncate">
                        {selCourse.code?.toUpperCase() || 'CODE'}
                      </span>
                   </div>
                   <div className="relative z-10 h-8 mt-auto flex">
                      <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=200')] bg-cover bg-center mix-blend-multiply opacity-50"></div>
                   </div>
                </div>
              </div>

              {/* Lessons List Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-[19px] sm:text-[21px] font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                    {lessonGroups.length} Lessons
                  </h2>
                  <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                    {selCourse.topics?.length || 0} total topics
                  </span>
                </div>

                {lessonGroups.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-[#1a1a24] rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-sm text-zinc-500 font-medium">No lessons published yet for this course.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-min mt-2">
                    {lessonGroups.map((group, lIdx) => {
                      const theme = COURSE_THEMES[lIdx % COURSE_THEMES.length];
                      const StampIcon = CHAPTER_STAMPS[lIdx % CHAPTER_STAMPS.length];
                      const topicCount = group.topics.length;

                      return (
                        <motion.div
                          key={group.name}
                          initial={{ opacity: 0, y: 15 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: lIdx * 0.04 }}
                          onClick={() => setOpenLessonIndex(lIdx)}
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
                              LESSON {lIdx + 1}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="space-y-1 sm:space-y-2 relative z-10 flex-1 flex flex-col justify-center items-center text-center select-none py-2">
                            <h3 className="text-base sm:text-xl font-black text-black leading-snug font-sans tracking-tight line-clamp-3 text-center transition-colors">
                              {group.name}
                            </h3>
                          </div>

                          {/* Bottom Bar */}
                          <div className="flex items-center border-t border-black/5 pt-1.5 sm:pt-2 relative z-10 mt-auto justify-between">
                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/5 flex items-center justify-center text-[#111827]/70">
                              <StampIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            </div>
                            <span className="text-[11px] sm:text-xs font-bold text-neutral-800 group-hover:underline">
                              {topicCount} {topicCount === 1 ? 'Topic' : 'Topics'} →
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

              {/* Lesson Modal Drawer for selected lesson */}
              {openLessonIndex !== null && lessonGroups[openLessonIndex] && (
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
                            {lessonGroups[openLessonIndex].topics.length} {lessonGroups[openLessonIndex].topics.length === 1 ? 'topic' : 'topics'}
                          </span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-tight mt-1">
                          {lessonGroups[openLessonIndex].name}
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
                        {lessonGroups[openLessonIndex].topics.map((topic, tIdx) => {
                          const read = isTopicRead(topic.id, readTopics);
                          return (
                            <div
                              key={topic.id}
                              onClick={() => {
                                setOpenLessonIndex(null);
                                navigate(`/study/${selCourse.id}/${topic.id}`);
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
                          const currentGroup = lessonGroups[openLessonIndex];
                          const nextTopic = currentGroup.topics.find(t => !isTopicRead(t.id, readTopics)) || currentGroup.topics[0];
                          setOpenLessonIndex(null);
                          if (nextTopic) {
                            navigate(`/study/${selCourse.id}/${nextTopic.id}`);
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
            </motion.div>
          );
        })()
      ) : (
        <div className="space-y-6 pt-2">
          {/* Course grid */}
          {filteredCourses.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 auto-rows-min mt-2 pb-12">
                {filteredCourses.map((course, index) => {
                  const theme = COURSE_THEMES[index % COURSE_THEMES.length];
                  const StampIcon = CHAPTER_STAMPS[index % CHAPTER_STAMPS.length];
                  const topicCount = course.topics?.length ?? 0;
                  return (
                    <motion.div
                      key={`lib-card-${course.id}-${index}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      onClick={() => setSelectedCourseId(course.id)}
                      className={`relative cursor-pointer group h-52 sm:h-60 p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] flex flex-col justify-between overflow-hidden border border-black/5 dark:border-none shadow-sm hover:scale-[1.02] hover:shadow-lg transition-all duration-300 ${theme.bg}`}
                    >
                      <div className="absolute inset-x-4 top-4 bottom-16 opacity-30 pointer-events-none">
                        <svg className="w-full h-full" viewBox="0 0 100 135" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M 20,25 C 60,15 75,35 45,55 C 15,75 80,75 50,105" className={theme.doodleColor} />
                        </svg>
                      </div>
                      <div className="flex justify-between items-center w-full relative z-10">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
                          <Star className={`w-4 h-4 ${theme.starColor} fill-current`} />
                        </div>
                        <span className="text-[11px] sm:text-[12px] font-extrabold tracking-widest uppercase font-mono bg-white/70 text-black px-3 py-1 rounded-[10px] shadow-sm border border-black/5">
                          {course.code?.toUpperCase()}
                        </span>
                      </div>
                      <div className="space-y-1 sm:space-y-1.5 relative z-10 flex-1 flex flex-col justify-center select-none pt-2">
                        <h3 className="text-[16px] sm:text-[22px] font-black text-black leading-tight font-sans tracking-tight line-clamp-3 transition-colors">
                          {course.title}
                        </h3>
                        <p className="text-[10px] sm:text-[12px] font-bold leading-normal text-neutral-800/70 line-clamp-1 mt-1">
                          {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
                        </p>
                      </div>
                      <div className="flex items-center border-t border-black/5 pt-1.5 sm:pt-2 relative z-10 mt-auto justify-between">
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/5 flex items-center justify-center text-[#111827]/70">
                          <StampIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </div>
                        <span className="text-[10px] font-bold text-neutral-800">View Lessons →</span>
                      </div>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-10 sm:h-12 pointer-events-none z-10 opacity-70">
                        <svg className="absolute inset-0 w-full h-full text-white dark:text-[#0B0F19] fill-current" viewBox="0 0 32 80" preserveAspectRatio="none">
                          <path d="M 32,0 C 32,18 14,18 14,40 C 14,62 32,62 32,80 Z" />
                        </svg>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-neutral-50 dark:bg-zinc-950 rounded-[32px] border border-dashed border-neutral-300 dark:border-zinc-800">
                <GraduationCap size={48} className="mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                <p className="font-black text-lg text-zinc-700 dark:text-zinc-300">
                  No courses yet for {semester === 1 ? '1st' : '2nd'} Semester
                </p>
                <p className="text-xs text-zinc-500 mt-2 max-w-xs mx-auto px-4">
                  The curriculum for {user?.department} {user?.level} hasn't been added yet.
                  Check back soon!
                </p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
