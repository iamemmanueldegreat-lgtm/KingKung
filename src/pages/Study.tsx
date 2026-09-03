import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Menu, X, Search, ChevronRight, LayoutPanelLeft, ChevronDown, CheckCircle2, Check, WifiOff, CloudDownload, DownloadCloud, Sparkles, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateStudyContent } from '../lib/api';
import { canUnlockTopic, unlockTopic } from '../lib/credits';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'react-hot-toast';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, query, orderBy, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import PracticeQuiz from '../components/PracticeQuiz';
import type { Topic } from '../types';
import LoadingScreen, { LoadingSpinner } from '../components/LoadingScreen';
import AskAiDrawer from '../components/AskAiDrawer';

const ensureString = (val: any): string => {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map(item => {
      const clean = typeof item === 'string' ? item : JSON.stringify(item);
      if (!clean.trim().startsWith('-') && !clean.trim().startsWith('*')) {
        return `- ${clean}`;
      }
      return clean;
    }).join('\n');
  }
  if (!val) return '';
  return String(val);
};

export default function Study() {
  const { courseId, topicId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const root = 'courses';
  const [content, setContent] = useState<string>('');
  const [keyTakeaways, setKeyTakeaways] = useState<string>('');
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState('');
  const [titles, setTitles] = useState({ course: '', topic: '' });
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicsDropdownOpen, setTopicsDropdownOpen] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<'online-not-saved' | 'saving' | 'offline-cached' | 'offline-uncached'>('online-not-saved');
  const [isAskAiOpen, setIsAskAiOpen] = useState(false);
  const [askAiMessages, setAskAiMessages] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [currentChapter, setCurrentChapter] = useState('');

  // active tab
  const [activeTab, setActiveTab] = useState('Explanation');
  const tabs = ['Explanation', 'Key Takeaways', 'Practice'];

  useEffect(() => {
    async function trackView() {
      if (!user || !courseId) return;
      try {
        await setDoc(doc(db, `users/${user.id}/recent_views`, courseId), {
          courseId,
          lastViewedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error tracking view:", err);
      }
    }
    trackView();
  }, [user, courseId]);

  useEffect(() => {
    let active = true;
    let stepInterval: any = null;

    async function loadData() {
      if (!courseId || !topicId) return;
      
      setLoading(true);
      setIsGenerating(false);
      
      const isOnline = navigator.onLine;

      try {
        // Step 1: Attempt to load from browser Local Storage or course_detail cache FIRST
        const localCacheKey = `offline_topic_${topicId}`;
        const localCacheData = localStorage.getItem(localCacheKey);

        let courseTitle = courseId;
        let fetchedTopicsList: Topic[] = [];

        // Try reading cached course details synchronously from localStorage
        const storedCourseDetail = localStorage.getItem(`course_detail_${courseId}`);
        if (storedCourseDetail) {
          try {
            const parsedDetail = JSON.parse(storedCourseDetail);
            if (parsedDetail.course?.title) courseTitle = parsedDetail.course.title;
            if (Array.isArray(parsedDetail.topics)) fetchedTopicsList = parsedDetail.topics;
          } catch (e) {
            console.warn('Error reading course detail from localStorage', e);
          }
        }

        if (fetchedTopicsList.length === 0) {
          const storedTitle = localStorage.getItem(`offline_course_title_${courseId}`);
          if (storedTitle) courseTitle = storedTitle;

          const storedTopics = localStorage.getItem(`offline_topics_list_${courseId}`);
          if (storedTopics) {
            try { fetchedTopicsList = JSON.parse(storedTopics); } catch (e) {}
          }
        }

        setTopics(fetchedTopicsList);

        // Match current topic
        const cachedTopic = fetchedTopicsList.find(t => t.id === topicId);
        const topicTitle = cachedTopic ? cachedTopic.title : topicId;
        setTitles({ course: courseTitle, topic: topicTitle });
        if (cachedTopic && cachedTopic.chapter) {
          setCurrentChapter(cachedTopic.chapter);
        } else {
          setCurrentChapter('Foundations');
        }

        // If local offline topic cache exists, render IMMEDIATELY
        if (localCacheData) {
          try {
            const parsedCache = JSON.parse(localCacheData);
            setContent(parsedCache.content);
            setKeyTakeaways(parsedCache.key_takeaways || '');
            setQuizQuestions(parsedCache.quiz_questions || []);
            setCacheStatus('offline-cached');
            setLoading(false);
          } catch (e) {}
        } else if (cachedTopic && cachedTopic.content) {
          // Content exists in cached topic! Render IMMEDIATELY
          setContent(cachedTopic.content);
          setKeyTakeaways(cachedTopic.key_takeaways || '');
          let parsedQuestions: any[] = [];
          if (cachedTopic.quiz_questions) {
            try {
              parsedQuestions = typeof cachedTopic.quiz_questions === 'string'
                ? JSON.parse(cachedTopic.quiz_questions)
                : cachedTopic.quiz_questions;
            } catch (pqErr) {}
          }
          setQuizQuestions(parsedQuestions);
          localStorage.setItem(localCacheKey, JSON.stringify({
            content: cachedTopic.content,
            key_takeaways: cachedTopic.key_takeaways || '',
            quiz_questions: parsedQuestions
          }));
          setCacheStatus('offline-cached');
          setLoading(false);
        }

        // Step 2: In background (or if no cache), fetch fresh data from Firestore if online
        if (isOnline) {
          try {
            const courseDoc = await getDoc(doc(db, root, courseId));
            if (!active) return;
            if (courseDoc.exists()) {
              courseTitle = courseDoc.data().title || courseId;
              localStorage.setItem(`offline_course_title_${courseId}`, courseTitle);
            }
            
            const topicsSnapshot = await getDocs(collection(db, `${root}/${courseId}/topics`));
            if (!active) return;
            const freshTopics = topicsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Topic));
            if (freshTopics.length > 0) {
              fetchedTopicsList = freshTopics;
              setTopics(freshTopics);
              localStorage.setItem(`offline_topics_list_${courseId}`, JSON.stringify(freshTopics));
              localStorage.setItem(`course_detail_${courseId}`, JSON.stringify({ course: { id: courseId, title: courseTitle }, topics: freshTopics }));
            }
          } catch (fireErr) {
            console.warn("Firestore fetch error, using local storage fallback", fireErr);
          }
        }

        if (!active) return;

        const currentTopic = fetchedTopicsList.find(t => t.id === topicId) || cachedTopic;
        if (currentTopic) {
          setTitles({ course: courseTitle, topic: currentTopic.title || topicId });
          if (currentTopic.chapter) setCurrentChapter(currentTopic.chapter);
        }

        // If content was already displayed from local cache, we are done
        if (localCacheData || (cachedTopic && cachedTopic.content)) {
          return;
        }

        // Step 3: Pre-generated content in Firestore
        if (isOnline && currentTopic) {
          if (currentTopic.content) {
            setContent(currentTopic.content);
            const takeaways = currentTopic.key_takeaways || '';
            setKeyTakeaways(takeaways);
            
            let parsedQuestions: any[] = [];
            if (currentTopic.quiz_questions) {
              try {
                parsedQuestions = typeof currentTopic.quiz_questions === 'string' 
                  ? JSON.parse(currentTopic.quiz_questions) 
                  : currentTopic.quiz_questions;
              } catch (pqErr) {}
            }
            setQuizQuestions(parsedQuestions);

            localStorage.setItem(localCacheKey, JSON.stringify({
              content: currentTopic.content,
              key_takeaways: takeaways,
              quiz_questions: parsedQuestions
            }));
            
            setCacheStatus('offline-cached');
            setLoading(false);
            return;
          } else {
            // No content in firestore, and online -> trigger on-demand generation!
            setLoading(false);
            setIsGenerating(true);
            setGenerationStep("Analyzing topic syllabus outline...");

            // Simulate progress step updates
            stepInterval = setInterval(() => {
              if (!active) {
                if (stepInterval) clearInterval(stepInterval);
                return;
              }
              const steps = [
                "Deploying DeepSeek educational researcher...",
                "Writing rich study guide with local examples...",
                "Synthesizing key takeaways and formulas...",
                "Compiling multiple-choice active practice questions..."
              ];
              setGenerationStep(prev => {
                const idx = steps.indexOf(prev);
                return idx < steps.length - 1 ? steps[idx + 1] : prev;
              });
            }, 3000);

            try {
              const userLevel = user?.level || "Undergraduate";
              const userDept = user?.department || "";
              const userSchool = user?.school || "";

              if (!canUnlockTopic(user, topicId!)) {
                if (stepInterval) clearInterval(stepInterval);
                toast.error('Free topic limit reached. Upgrade to Pro to unlock unlimited topics.', { duration: 4000 });
                setLoading(false);
                setGenerationStep('');
                navigate('/billing');
                return;
              }
              if (user?.id) unlockTopic(user.id, topicId!).catch(console.error);

              const studyPackage = await generateStudyContent(topicTitle, courseTitle, userLevel, userDept, userSchool);
              if (stepInterval) clearInterval(stepInterval);
              if (!active) return;
              
              setGenerationStep("Writing content back to cloud storage...");
              
              setContent(studyPackage.content);
              setKeyTakeaways(studyPackage.key_takeaways);
              setQuizQuestions(studyPackage.quiz_questions);

              // Update Firestore backend asynchronously (don't block the user if it fails or lags due to permissions)
              try {
                const topicRef = doc(db, `${root}/${courseId}/topics`, topicId);
                await updateDoc(topicRef, {
                  content: studyPackage.content,
                  key_takeaways: studyPackage.key_takeaways,
                  quiz_questions: JSON.stringify(studyPackage.quiz_questions)
                });
              } catch (fsErr) {
                console.error("Non-fatal Firestore write error (likely rules):", fsErr);
              }

              if (!active) return;

              // DOWNLOAD & PERSIST OFFLINE
              setGenerationStep("Downloading and caching local offline copy...");
              localStorage.setItem(localCacheKey, JSON.stringify({
                content: studyPackage.content,
                key_takeaways: studyPackage.key_takeaways,
                quiz_questions: studyPackage.quiz_questions
              }));

              setCacheStatus('offline-cached');
              toast.success("Successfully generated & downloaded for offline access!");
            } catch (genErr: any) {
              if (stepInterval) clearInterval(stepInterval);
              if (!active) return;
              toast.error(genErr.message || "Failed to generate on-demand study guide.");
              setContent("> **On-Demand Generation Failed**\n\nThere was an issue communicating with the AI. Please verify your internet connection or try reloading the page.");
            } finally {
              if (active) {
                setIsGenerating(false);
              }
            }
          }
        } else {
          // Uncached and offline: Cannot generate!
          setContent("> **Offline Mode**\n\nThis topic has not been downloaded for offline viewing yet. Please connect to the internet to download and view this topic's study material anytime.");
          setCacheStatus('offline-uncached');
        }

      } catch (err: any) {
        if (active) {
          toast.error(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadData();
    
    return () => {
      active = false;
      if (stepInterval) clearInterval(stepInterval);
    };
  }, [courseId, topicId]);

  const filteredTopics = topics.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex h-[100dvh] bg-background text-text font-sans overflow-hidden">
      
      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto custom-scrollbar relative">
        
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl px-4 sm:px-6 py-4 flex items-center justify-between pointer-events-none border-b border-border">
          <div className="flex items-center gap-4 pointer-events-auto">
            <button 
              onClick={() => {
                if (currentChapter) {
                  navigate(`/course/${courseId}?chapter=${encodeURIComponent(currentChapter)}`);
                } else {
                  navigate(`/course/${courseId}`);
                }
              }} 
              className="p-2 -ml-2 rounded-lg hover:bg-muted/10 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft size={24} />
              <span className="hidden sm:inline font-semibold">Back to Topics</span>
            </button>
          </div>
          <div className="flex items-center gap-4 pointer-events-auto">
            {cacheStatus === 'offline-cached' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <Check size={12} className="stroke-[3]" /> Saved Offline
              </span>
            )}
            {cacheStatus === 'offline-uncached' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                <WifiOff size={12} /> Uncached Offline
              </span>
            )}
            <ThemeToggle />
          </div>
        </header>

        {/* Content Wrapper */}
        <div className="w-full px-4 sm:px-6 xl:px-8 pb-24 pt-4">
          
          {isGenerating ? (
            <div className="py-24 sm:py-32 flex flex-col items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : loading ? (
             <div className="py-24 sm:py-32 flex flex-col items-center justify-center">
                <LoadingSpinner />
             </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-sm font-semibold tracking-wide text-primary uppercase mb-2 mt-4">{titles.course}</p>
              {/* Title Section */}
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold tracking-tight mb-6 sm:mb-8 leading-[1.1]">{titles.topic}</h1>
              
              {/* Tabs */}
              <div className="flex items-center gap-2 border-b border-border mb-10 overflow-x-auto custom-scrollbar pb-px">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 
                      ${activeTab === tab 
                        ? 'border-primary text-text' 
                        : 'border-transparent text-muted hover:text-text'}
                    `}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Document Text */}
              <article className="prose prose-slate dark:prose-invert max-w-none prose-lg
                prose-headings:font-semibold prose-headings:tracking-tight 
                prose-p:leading-8 prose-p:text-text 
                prose-a:text-primary prose-li:text-text prose-li:leading-8
                marker:text-muted
              ">
                {activeTab === 'Explanation' && (
                   <div className="animate-in fade-in duration-300">
                     <Markdown remarkPlugins={[remarkGfm]}>{ensureString(content)}</Markdown>
                   </div>
                )}
                {activeTab === 'Key Takeaways' && (
                   keyTakeaways ? (
                     <div className="animate-in fade-in duration-300">
                       <Markdown remarkPlugins={[remarkGfm]}>{ensureString(keyTakeaways)}</Markdown>
                     </div>
                   ) : (
                     <div className="text-center py-20 text-muted">
                       <p>No key takeaways found for this topic.</p>
                     </div>
                   )
                )}
                {activeTab === 'Practice' && (
                   <div className="animate-in fade-in duration-300">
                     <PracticeQuiz 
                       onCancel={() => setActiveTab('Explanation')}
                       courseTitle={titles.course} 
                       courseCode={courseId || ''} 
                       topicTitle={titles.topic}
                       topicId={topicId}
                       preGeneratedQuestions={quizQuestions}
                       chapter={currentChapter}
                     />
                   </div>
                 )}
              </article>
            </motion.div>
          )}

        </div>

        {/* Floating Ask AI Button — raised above the bottom tab bar (tab bar is fixed bottom-6 h-16) */}
        {!loading && !isGenerating && content && (
          <button
            onClick={() => setIsAskAiOpen(true)}
            className="fixed right-4 sm:right-6 bottom-24 sm:bottom-[6.5rem] z-40 bg-[#163038] hover:bg-[#163038]/90 text-white dark:bg-white dark:hover:bg-white/95 dark:text-black font-sans font-bold shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 rounded-full py-3 px-5 flex items-center gap-2 group cursor-pointer border border-[#163038]/10 dark:border-white/10"
          >
            <Sparkles size={16} className="animate-pulse group-hover:rotate-12 transition-transform duration-300 text-white dark:text-black" />
            <span className="text-sm tracking-wide">Ask AI</span>
          </button>
        )}

        {/* Ask AI Contextual Interactive Bottom Sheet Drawer (75% height) */}
        <AskAiDrawer 
          isOpen={isAskAiOpen} 
          onClose={() => setIsAskAiOpen(false)} 
          topicTitle={titles.topic} 
          courseTitle={titles.course} 
          studyContext={content} 
          messages={askAiMessages}
          setMessages={setAskAiMessages}
        />
      </main>

    </div>
  );
}

