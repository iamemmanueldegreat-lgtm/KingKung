import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { canSendChat, spendChatCredit } from '../lib/credits';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { AiSearchSparkleIcon } from '../components/AiSearchSparkleIcon';
import { 
  ArrowLeft,
  Sparkles,
  Loader2,
  Trash2,
  Menu,
  Plus,
  Mic,
  PenSquare,
  MoreHorizontal,
  Search,
  X,
  Square,
  BookOpen,
  MessageSquare,
  Lock,
  Share2,
  Maximize2,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  FileText,
  Lightbulb,
  GraduationCap,
  Volume2,
  SlidersHorizontal,
  Sun,
  Moon,
  Link as LinkIcon
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, doc, serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'model';
  parts: { text: string }[];
  thought?: string;
  contextTag?: string;
  sources?: { title: string; type: 'doc' | 'topic' | 'quiz' }[];
}

interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  createdAt: any;
  updatedAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

const STUDENT_PROMPTS = [
  {
    icon: Sparkles,
    title: "Explain a Concept",
    description: "Deep dive into a difficult topic with active physical, real-world examples",
    promptText: "Can you break down and explain a complex academic concept simply with real-world examples so I can grasp it instantly?",
  },
  {
    icon: GraduationCap,
    title: "Detailed Study Plan",
    description: "Help me organize a detailed 1-week prep schedule for upcoming exams",
    promptText: "I have exams coming up. Help me build a strategic, realistic day-by-day 1-week study plan to prepare efficiently.",
  },
  {
    icon: BookOpen,
    title: "Mock Practice Quiz",
    description: "Test my learning with interactive multi-choice quiz questions",
    promptText: "Give me an interactive 5-question multiple choice practice quiz on core academic topics with complete detailed feedback for answers.",
  },
  {
    icon: Lightbulb,
    title: "Active Recall Cards",
    description: "Convert dry study materials into summarized key recall cards",
    promptText: "Provide me with active recall study prompts, questions, and summarized bullet-point learning tables for study reviews.",
  }
];

export default function Chat() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState(() => localStorage.getItem('kortex_chat_draft_input') || '');
  const [isTyping, setIsTyping] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [activeModel, setActiveModel] = useState<'Kortex AI 3.0' | 'Kortex Flash'>('Kortex AI 3.0');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [attachedContext, setAttachedContext] = useState<string | null>(
    user?.department && user?.level ? `${user.department} • ${user.level}` : 'Academic Mode'
  );
  const [openThoughts, setOpenThoughts] = useState<Record<number, boolean>>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsTyping(false);
  };

  useEffect(() => {
    localStorage.setItem('kortex_chat_draft_input', input);
  }, [input]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 150;
    setShowScrollBottom(isFarFromBottom);
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    const loadSessions = async () => {
      if (!user) return;
      try {
        const q = query(
          collection(db, 'chat_sessions'),
          where('userId', '==', user.id)
        );
        const snapshot = await getDocs(q);
        const loadedSessions = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ChatSession[];
        
        loadedSessions.sort((a, b) => {
          const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : Date.parse(a.updatedAt || '0');
          const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : Date.parse(b.updatedAt || '0');
          return timeB - timeA;
        });

        const seenSessionIds = new Set<string>();
        const uniqueSessions: ChatSession[] = [];
        for (const s of loadedSessions) {
          if (s && s.id && !seenSessionIds.has(s.id)) {
            seenSessionIds.add(s.id);
            uniqueSessions.push(s);
          }
        }

        setSessions(uniqueSessions);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'chat_sessions');
      }
    };
    loadSessions();
  }, [user]);

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        startNewChat();
      }
      const sessionRef = doc(db, 'chat_sessions', sessionId);
      await deleteDoc(sessionRef);
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const saveMessageToSession = async (currentMessages: Message[], newMessage: Message, overrideSessionId?: string | null) => {
    if (!user) return null;
    const combinedMessages = [...currentMessages, newMessage];
    const targetSessionId = overrideSessionId !== undefined ? overrideSessionId : currentSessionId;
    
    const serializedMessages = combinedMessages.map(m => ({
      role: m.role,
      parts: m.parts.map(p => ({ text: p.text })),
      thought: m.thought || '',
      contextTag: m.contextTag || '',
      sources: m.sources || []
    }));

    try {
      if (!targetSessionId) {
        const title = serializedMessages[0]?.parts[0]?.text?.substring(0, 40) || 'New Chat';
        const docRef = doc(collection(db, 'chat_sessions'));
        const sessionData = {
          userId: user.id,
          title: title + (title.length >= 40 ? '...' : ''),
          messages: serializedMessages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(docRef, sessionData);
        setCurrentSessionId(docRef.id);
        setSessions(prev => {
          const filtered = prev.filter(s => s.id !== docRef.id);
          return [{ id: docRef.id, ...sessionData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as ChatSession, ...filtered];
        });
        return docRef.id;
      } else {
        const sessionRef = doc(db, 'chat_sessions', targetSessionId);
        const title = serializedMessages[0]?.parts[0]?.text?.substring(0, 40) || 'New Chat';
        const updateData = {
          title: title + (title.length >= 40 ? '...' : ''),
          messages: serializedMessages,
          updatedAt: serverTimestamp()
        };
        await updateDoc(sessionRef, updateData);
        setSessions(prev => prev.map(s => s.id === targetSessionId ? { ...s, messages: serializedMessages, updatedAt: new Date().toISOString() } as ChatSession : s));
        return targetSessionId;
      }
    } catch (error) {
      console.error('Failed to save session:', error);
      return targetSessionId;
    }
  };

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please try Chrome, Edge, or Safari.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      toast.dismiss('voice-toast');
      toast('Voice recording stopped');
    } else {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        const initialText = input ? input.trim() + ' ' : '';

        recognition.onstart = () => {
          setIsRecording(true);
          toast.success("Listening... Speak now", { id: 'voice-toast' });
        };

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInput(initialText + transcript);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition notice:", event.error);
          setIsRecording(false);
          toast.dismiss('voice-toast');
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            toast.error("Microphone permission denied or unavailable in this environment.");
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            toast.error(`Voice input error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          toast.dismiss('voice-toast');
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err) {
        console.error("Failed to start speech recognition:", err);
        setIsRecording(false);
        toast.error("Could not start microphone input.");
      }
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isTyping) {
      stopGeneration();
      return;
    }
    if (!input.trim()) return;

    if (!canSendChat(user)) {
      toast.error('You\'ve used all free chat credits. Upgrade to Pro for unlimited messages.', { duration: 4000 });
      navigate('/billing');
      return;
    }
    if (user?.id) spendChatCredit(user.id).catch(console.error);

    const userText = input.trim();
    const userMessage: Message = { 
      role: 'user', 
      parts: [{ text: userText }]
    };
    const historyBeforeResponse = [...messages, userMessage];
    
    setMessages(historyBeforeResponse);
    setInput('');
    setIsTyping(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const activeSessionId = await saveMessageToSession(messages, userMessage, currentSessionId);

    try {
      const validHistory = historyBeforeResponse.filter(m => m.parts && m.parts[0].text);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeModel === 'Kortex AI 3.0' ? 'flash' : 'flash',
          messages: validHistory.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.parts[0].text
          })),
          student: {
            department: user?.department || '',
            level: user?.level || '',
            school: user?.school || '',
            fullName: user?.full_name || ''
          }
        })
      });

      if (!res.ok) throw new Error("Failed to communicate with chat API");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let accumulatedText = "";
      const defaultThought = `Analyzing request against student department context (${user?.department || 'General'})...`;
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        parts: [{ text: '' }],
        thought: defaultThought
      }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.text) {
                accumulatedText += data.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'model',
                    parts: [{ text: accumulatedText }],
                    thought: defaultThought
                  };
                  return updated;
                });
              }
            } catch (e) {
              console.error("Error parsing stream chunk", e);
            }
          }
        }
      }
      
      const modelMessage: Message = { 
        role: 'model', 
        parts: [{ text: accumulatedText }],
        thought: defaultThought
      };
      await saveMessageToSession(historyBeforeResponse, modelMessage, activeSessionId);

    } catch (error: any) {
      if (error?.name === 'AbortError') {
        toast('Generation cancelled');
        return;
      }
      console.error("Chat Error:", error);
      const errorMessage: Message = { 
        role: 'model', 
        parts: [{ text: "Sorry, I ran into an issue while processing your request. Please try again." }] 
      };
      setMessages(prev => [...prev, errorMessage]);
      await saveMessageToSession(historyBeforeResponse, errorMessage, activeSessionId);
    } finally {
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    setIsSidebarOpen(false);
  };
  
  const loadSession = (session: ChatSession) => {
    setMessages(session.messages || []);
    setCurrentSessionId(session.id);
    setIsSidebarOpen(false);
  };

  const toggleThought = (idx: number) => {
    setOpenThoughts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="flex flex-col flex-1 w-full h-screen bg-slate-50 dark:bg-[#141416] text-zinc-900 dark:text-[#e4e4e7] overflow-hidden font-sans select-none transition-colors duration-200">
      
      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 dark:bg-black/75 backdrop-blur-md"
            />
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed left-0 top-0 bottom-0 w-[80vw] sm:w-[80vw] md:w-[75vw] max-w-xl z-50 bg-slate-50/95 dark:bg-[#121316]/95 backdrop-blur-2xl border-r border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl rounded-r-[32px] sm:rounded-r-[44px] flex flex-col p-4 sm:p-6 overflow-hidden select-none"
            >
              {/* Floating Header Bar inside History Sidebar */}
              <div className="flex items-center justify-between gap-2.5 mb-4 shrink-0">
                {/* Floating Title Card - fits phrase with snug padding */}
                <div className="inline-flex items-center gap-2.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 shadow-sm rounded-full px-4 py-2 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 shadow-xs">
                    <AiSearchSparkleIcon size={14} />
                  </div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-xs sm:text-sm tracking-tight text-zinc-900 dark:text-white font-sans whitespace-nowrap">
                      Chat History
                    </h2>
                    <span className="text-[10px] font-extrabold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800/90 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {sessions.length}
                    </span>
                  </div>
                </div>

                {/* Floating Close Button */}
                <motion.button 
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setIsSidebarOpen(false)} 
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                  title="Close History"
                  aria-label="Close History"
                >
                  <X size={18} className="stroke-[2.5]" />
                </motion.button>
              </div>

              {/* Floating Action Controls inside History */}
              <div className="space-y-3 mb-4 shrink-0">
                {/* New Chat Pill */}
                <motion.button 
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    startNewChat();
                    setIsSidebarOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-full shadow-md hover:shadow-lg font-black text-xs sm:text-sm tracking-wide transition-all cursor-pointer group"
                >
                  <PenSquare size={16} className="stroke-[2.2]" />
                  <span>Start New Conversation</span>
                </motion.button>

                {/* Search Filter Bar Pill */}
                <div className="relative">
                  <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                  <input 
                    type="text" 
                    placeholder="Search conversations..." 
                    value={historySearch} 
                    onChange={(e) => setHistorySearch(e.target.value)} 
                    className="w-full pl-10 pr-9 py-2.5 rounded-full text-xs font-semibold bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-xs transition-all font-sans"
                  />
                  {historySearch && (
                    <button 
                      onClick={() => setHistorySearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Conversations List with Refined Typography & Round Cards */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-none">
                <div>
                  <div className="px-3 flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-sans">
                      Recent Conversations
                    </h3>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800/80 px-2.5 py-0.5 rounded-full">
                      {sessions.filter(s => (s.title || '').toLowerCase().includes(historySearch.toLowerCase())).length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {sessions.filter(s => (s.title || '').toLowerCase().includes(historySearch.toLowerCase())).length > 0 ? (
                      sessions.filter(s => (s.title || '').toLowerCase().includes(historySearch.toLowerCase())).map((session, sIdx) => {
                        const isSelected = currentSessionId === session.id;
                        return (
                          <motion.div 
                            key={`session-${session.id}-${sIdx}`}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className={`group relative flex items-center justify-between rounded-full px-4 py-3 text-xs sm:text-sm font-semibold cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 shadow-md font-bold' 
                                : 'bg-white/70 dark:bg-zinc-900/40 hover:bg-white dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/60 dark:border-zinc-800/60 shadow-xs'
                            }`}
                          >
                            <button 
                              onClick={() => {
                                loadSession(session);
                                setIsSidebarOpen(false);
                              }} 
                              className="flex-1 flex items-center gap-3 text-left truncate pr-8 cursor-pointer"
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700'
                              }`}>
                                <MessageSquare size={14} className="stroke-[2.2]" />
                              </div>
                              <div className="min-w-0 flex-1 truncate">
                                <span className="block truncate text-xs sm:text-sm font-bold tracking-tight text-zinc-800 dark:text-zinc-100 group-hover:text-zinc-900 dark:group-hover:text-white font-sans">
                                  {session.title}
                                </span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteSession(e, session.id)}
                              className="absolute right-3 p-1.5 rounded-full text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                              title="Delete Chat"
                            >
                              <Trash2 size={13} />
                            </button>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center bg-white/60 dark:bg-zinc-900/40 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                        <MessageSquare size={24} className="mx-auto mb-2 text-zinc-400 dark:text-zinc-600 stroke-[1.5]" />
                        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 font-sans">
                          {historySearch ? 'No matching conversations' : 'No recent chats saved'}
                        </p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 font-sans">
                          {historySearch ? 'Try a different search query' : 'Start a new chat to begin'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modern Floating App Bar Header */}
      <motion.header 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="flex-shrink-0 pt-3.5 pb-2 px-3 sm:px-6 flex items-center justify-between z-30 select-none bg-transparent w-full max-w-7xl mx-auto pointer-events-none"
      >
        {/* Left Side: Floating Menu & Floating New Chat Cards */}
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          {/* Hamburger Menu Card */}
          <motion.button 
            whileTap={{ scale: 0.93 }}
            onClick={() => setIsSidebarOpen(true)}
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md flex items-center justify-center transition-all cursor-pointer"
            title="Open Conversations Menu"
            aria-label="Open menu"
          >
            <Menu size={19} className="stroke-[2.2]" />
          </motion.button>

          {/* New Chat Floating Pill */}
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={startNewChat}
            className="h-10 sm:h-11 px-4 sm:px-5 rounded-full bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md flex items-center gap-2 text-xs sm:text-sm font-bold transition-all cursor-pointer group"
            title="Start a new chat"
          >
            <span className="font-extrabold tracking-tight">New chat</span>
            <PenSquare size={13} className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors" />
          </motion.button>
        </div>

        {/* Right Side: Floating Action Cards */}
        <div className="flex items-center gap-2 sm:gap-2.5 pointer-events-auto">
          {/* Fullscreen Toggle Card */}
          <motion.button 
            whileTap={{ scale: 0.93 }}
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              } else {
                document.documentElement.requestFullscreen().catch(() => {});
              }
            }}
            className="hidden sm:flex w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md items-center justify-center transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            <Maximize2 size={16} />
          </motion.button>

          {/* Share Button Card */}
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              toast.success('Chat link copied!');
            }}
            className="hidden sm:inline-flex items-center gap-1.5 h-10 sm:h-11 px-4 rounded-full bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-bold border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
            title="Share Chat"
          >
            <Share2 size={14} />
            <span>Share</span>
          </motion.button>

          {/* Cancel Button Card */}
          <motion.button 
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              stopGeneration();
              navigate('/');
            }}
            className="h-10 sm:h-11 px-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-extrabold text-xs rounded-full border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            title="Cancel and Go Back"
            aria-label="Cancel"
          >
            <X size={15} className="stroke-[2.5]" />
            <span>Cancel</span>
          </motion.button>
        </div>
      </motion.header>

      {/* Chat Messages Stream Area */}
      <div 
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-8 pt-6 pb-36 select-text custom-scrollbar flex flex-col items-center"
      >
        <div className={`w-full max-w-3xl space-y-7 ${messages.length === 0 ? 'flex-1 flex flex-col justify-center items-center my-auto' : ''}`}>
          
          {/* Default Empty Screen Prompts */}
          {messages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-12 sm:py-20 flex flex-col items-center text-center space-y-3 my-auto"
            >
              <div className="space-y-2 max-w-lg">
                <h2 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                  What would you like to learn today?
                </h2>
                <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Ask Kortex AI to break down complex topics, draft study schedules, generate practice quizzes, or solve academic problems.
                </p>
              </div>
            </motion.div>
          )}

          {/* Message List */}
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';

            if (isUser) {
              return (
                <motion.div 
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={idx} 
                  className="flex flex-col items-end space-y-1.5 w-full"
                >
                  {/* User Bubble */}
                  <div className="flex items-center gap-2.5 max-w-[85%] sm:max-w-[75%]">
                    <div className="bg-zinc-900 dark:bg-[#2d2e36] text-white px-5 py-3 rounded-[22px] rounded-tr-md text-sm sm:text-[15px] leading-relaxed shadow-sm border border-zinc-800 dark:border-zinc-700/50 break-words">
                      {msg.parts[0].text}
                    </div>
                    {user?.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.full_name || 'User'} 
                        className="w-8 h-8 rounded-full object-cover shrink-0 border border-zinc-300 dark:border-zinc-600 shadow-sm"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-white text-xs font-bold flex items-center justify-center shrink-0 border border-zinc-300 dark:border-zinc-600 uppercase">
                        {user?.full_name?.slice(0, 1) || 'U'}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            }

            // AI Model Response Message
            return (
              <motion.div 
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                key={idx} 
                className="flex flex-col space-y-3 w-full text-zinc-800 dark:text-zinc-200"
              >
                {/* 1. Thought Accordion */}
                {msg.thought && (
                  <div className="border-b border-zinc-200 dark:border-zinc-800/40 pb-1">
                    <button
                      type="button"
                      onClick={() => toggleThought(idx)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer py-1"
                    >
                      <Lightbulb size={13} className="text-amber-500 dark:text-amber-400/90" />
                      <span>Thought</span>
                      <ChevronRight size={13} className={`transition-transform duration-200 ${openThoughts[idx] ? 'rotate-90' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {openThoughts[idx] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="text-xs text-zinc-600 dark:text-zinc-400 pl-5 pr-2 py-2 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-800/80 my-1 font-mono"
                        >
                          {msg.thought}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* AI Text Response formatted markdown */}
                <div className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200 w-full pt-1">
                  <div className="markdown-body break-words prose prose-slate dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-headings:tracking-tight prose-h2:text-lg prose-h2:text-zinc-900 dark:prose-h2:text-white prose-h3:text-base prose-h3:text-zinc-800 dark:prose-h3:text-zinc-100 prose-li:my-1 prose-pre:bg-zinc-900 prose-pre:text-zinc-100 dark:prose-pre:bg-[#18191e] prose-pre:border prose-pre:border-zinc-200 dark:prose-pre:border-zinc-800 prose-pre:rounded-xl">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.parts[0].text}</Markdown>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && messages[messages.length - 1]?.role !== 'model' && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 py-2 text-xs text-zinc-500 dark:text-zinc-400"
            >
              <div className="w-4 h-4 rounded-full border-2 border-zinc-800 dark:border-zinc-200 border-t-transparent animate-spin shrink-0" />
              <span className="font-medium animate-pulse">Generating Kortex AI explanation...</span>
            </motion.div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Floating Scroll to Bottom Arrow Button */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="fixed bottom-28 right-8 sm:right-1/2 sm:translate-x-1/2 z-20 w-9 h-9 rounded-full bg-white dark:bg-[#272830] hover:bg-zinc-100 dark:hover:bg-[#32333d] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700/60 shadow-lg flex items-center justify-center cursor-pointer transition-all"
            title="Scroll to bottom"
          >
            <ArrowDown size={16} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Floating Input Card Container */}
      <div className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-slate-50 via-slate-50/95 dark:from-[#141416] dark:via-[#141416]/95 to-transparent z-20 pointer-events-none flex flex-col items-center">
        <div className="pointer-events-auto w-full max-w-3xl">
          
          <form 
            onSubmit={handleSubmit}
            className="bg-white dark:bg-[#1c1d22] border border-zinc-200 dark:border-zinc-800 rounded-[24px] p-3 shadow-2xl focus-within:border-zinc-300 dark:focus-within:border-zinc-700 focus-within:ring-1 focus-within:ring-zinc-300/50 dark:focus-within:ring-zinc-700/50 transition-all flex flex-col gap-2.5"
          >
            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask Kortex AI anything..."
              className="bg-transparent border-none px-2 py-1 text-sm sm:text-[15px] text-zinc-900 dark:text-white focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-500 resize-none max-h-[180px] min-h-[42px] overflow-y-auto leading-relaxed scrollbar-none"
            />

            {/* Bottom Toolbar Row inside input card */}
            <div className="flex items-center justify-between pt-0.5">
              
              {/* Left Side Tools & Model Selector */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Model Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/60 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span className="shrink-0 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
                      <AiSearchSparkleIcon size={14} />
                    </span>
                    <span className="leading-none">{activeModel}</span>
                    <span className="text-[9px] px-1.5 py-0.5 leading-none rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-mono font-bold">
                      {activeModel === 'Kortex AI 3.0' ? 'Pro' : 'Fast'}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showModelMenu && (
                      <>
                        {/* Click Outside Transparent Backdrop */}
                        <div 
                          className="fixed inset-0 z-40 bg-transparent cursor-default" 
                          onClick={() => setShowModelMenu(false)} 
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 5, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.96 }}
                          className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-[#23242a] border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl p-1.5 z-50 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => { setActiveModel('Kortex AI 3.0'); setShowModelMenu(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between font-medium cursor-pointer transition-colors ${
                              activeModel === 'Kortex AI 3.0' 
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold' 
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span>Kortex AI 3.0</span>
                            <span className="text-[9px] opacity-80 font-mono">Pro</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setActiveModel('Kortex Flash'); setShowModelMenu(false); }}
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between font-medium cursor-pointer transition-colors ${
                              activeModel === 'Kortex Flash' 
                                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold' 
                                : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <span>Kortex Flash</span>
                            <span className="text-[9px] opacity-80 font-mono">Fast</span>
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* Relevant Kortex AI Quick Tools */}
                <button
                  type="button"
                  onClick={() => setInput('Summarize key points and takeaways from ')}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0 hidden sm:flex"
                  title="Summarize"
                >
                  <FileText size={15} />
                </button>
              </div>

              {/* Right Side: Voice Mic + Send Button */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                    isRecording 
                      ? 'bg-red-500/20 text-red-500 dark:text-red-400 animate-pulse' 
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                  title="Voice Input"
                >
                  <Mic size={16} />
                </button>

                {isTyping ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="w-9 h-9 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                    title="Stop Generating"
                  >
                    <Square size={13} className="fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                      input.trim()
                        ? 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 shadow-md active:scale-95' 
                        : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                    }`}
                    title="Send Message"
                  >
                    <ArrowUp size={18} className="stroke-[2.5]" />
                  </button>
                )}
              </div>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}

