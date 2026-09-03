import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, ArrowUp, Plus, Mic, GraduationCap, ChevronRight, Lightbulb, BookOpen } from 'lucide-react';
import { AiSearchSparkleIcon } from './AiSearchSparkleIcon';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { canSendChat, spendChatCredit } from '../lib/credits';

interface AskAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  topicTitle: string;
  courseTitle: string;
  studyContext: string;
  messages: { role: 'user' | 'model'; content: string; thought?: string; contextTag?: string }[];
  setMessages: React.Dispatch<React.SetStateAction<{ role: 'user' | 'model'; content: string; thought?: string; contextTag?: string }[]>>;
}

export default function AskAiDrawer({
  isOpen,
  onClose,
  topicTitle,
  courseTitle,
  studyContext,
  messages,
  setMessages
}: AskAiDrawerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [openThoughts, setOpenThoughts] = useState<Record<number, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const toggleRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsRecording(false);
      toast.dismiss('drawer-voice-toast');
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
          toast.success("Listening... Speak now", { id: 'drawer-voice-toast' });
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
          toast.dismiss('drawer-voice-toast');
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            toast.error("Microphone permission denied or unavailable in this environment.");
          } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
            toast.error(`Voice input error: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsRecording(false);
          toast.dismiss('drawer-voice-toast');
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

  useEffect(() => {
    const defaultGreeting = (topicName: string, courseName: string) => {
      const displayTopic = topicName ? `"${topicName}"` : 'your study guide';
      const displayCourse = courseName ? `"${courseName}"` : 'your current course';
      return `Hi **${user?.full_name || 'there'}**! I am **Kortex AI**, your personal tutor.

I have analyzed the study guide for **${displayTopic}** in the course **${displayCourse}** tailored for your **${user?.department || 'Computer Science'}** department at the **${user?.level || 'ND 1'}** level.

What part of this lesson would you like me to explain further? Just ask! 📚`;
    };

    if (messages.length === 0) {
      setMessages([
        {
          role: 'model',
          content: defaultGreeting(topicTitle, courseTitle),
          thought: `Loaded lesson context for "${topicTitle}" in "${courseTitle}". Target level: ${user?.level || 'ND 1'}.`,
          contextTag: topicTitle ? `Topic: ${topicTitle}` : undefined
        }
      ]);
    } else if (messages.length === 1 && messages[0].role === 'model') {
      const firstContent = messages[0].content;
      if ((firstContent.includes('""') || firstContent.includes('"your study guide"')) && (topicTitle || courseTitle)) {
        setMessages([
          {
            role: 'model',
            content: defaultGreeting(topicTitle, courseTitle),
            thought: `Loaded lesson context for "${topicTitle}" in "${courseTitle}". Target level: ${user?.level || 'ND 1'}.`,
            contextTag: topicTitle ? `Topic: ${topicTitle}` : undefined
          }
        ]);
      }
    }
  }, [messages, topicTitle, courseTitle, user, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isTyping ? 'auto' : 'smooth' });
  }, [messages, isTyping]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentY = e.targetTouches[0].clientY;
    const diffY = currentY - touchStart;

    const container = e.currentTarget;
    if (container.scrollTop <= 0 && diffY > 70) {
      onClose();
      setTouchStart(null);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;

    if (!canSendChat(user)) {
      toast.error('You\'ve used all 10 free questions. Upgrade to Pro to keep asking.', { duration: 4000 });
      navigate('/billing');
      return;
    }
    if (user?.id) spendChatCredit(user.id).catch(console.error);

    const userMessage = { 
      role: 'user' as const, 
      content: input.trim(),
      contextTag: topicTitle ? `${courseTitle || 'Course'} • ${topicTitle}` : undefined 
    };
    const historyBeforeResponse = [...messages, userMessage];
    
    setMessages(historyBeforeResponse);
    setInput('');
    setIsTyping(true);

    try {
      const validHistory = historyBeforeResponse.filter(m => m.content);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: 'flash',
          messages: validHistory,
          topicTitle,
          courseTitle,
          studyContext,
          student: {
            department: user?.department || '',
            level: user?.level || '',
            school: user?.school || '',
            fullName: user?.full_name || ''
          }
        })
      });

      if (!res.ok) throw new Error("Failed to communicate with tutor API");
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let accumulatedText = "";
      const defaultThought = `Analyzing lesson details for "${topicTitle}" against curriculum standards...`;
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        content: '',
        thought: defaultThought,
        contextTag: topicTitle ? `Topic: ${topicTitle}` : undefined
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
                    content: accumulatedText,
                    thought: defaultThought,
                    contextTag: topicTitle ? `Topic: ${topicTitle}` : undefined
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
    } catch (err) {
      console.error("Ask AI Drawer Chat Error:", err);
      setMessages(prev => [
        ...prev,
        {
          role: 'model',
          content: "I'm sorry, I encountered an issue speaking with my cloud brain right now. Please check your internet or try again."
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleThought = (idx: number) => {
    setOpenThoughts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            id="ask-ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] cursor-pointer"
          />

          <motion.div
            id="ask-ai-drawer"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 800 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(e, info) => {
              if (info.offset.y > 100 || info.velocity.y > 250) {
                onClose();
              }
            }}
            className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-4xl h-[92vh] bg-[#141416] text-[#e4e4e7] rounded-t-[2rem] border-t border-zinc-800 shadow-2xl z-[101] flex flex-col overflow-hidden select-none"
          >
            {/* Grab Handle pill */}
            <div className="w-12 h-1.5 bg-zinc-700/60 rounded-full mx-auto mt-3 mb-1 cursor-grab active:cursor-grabbing shrink-0" />

            {/* Header */}
            <div 
              className="px-6 pb-3 pt-1 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-[#18181b]"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-zinc-800 text-white flex items-center justify-center shrink-0 shadow-md border border-zinc-700">
                  <AiSearchSparkleIcon size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-white tracking-tight flex items-center gap-2">
                    <span>Kortex AI Tutor</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">Active Lesson</span>
                  </h3>
                  <p className="text-xs text-zinc-400 font-mono truncate max-w-[220px] sm:max-w-md">
                    {topicTitle ? `${topicTitle}` : 'Course Study Guide'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Messages Stream */}
            <div 
              className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 select-text custom-scrollbar bg-[#141416]"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {messages.map((m, idx) => {
                const isUser = m.role === 'user';
                if (isUser) {
                  return (
                    <div key={idx} className="flex flex-col items-end space-y-1.5 w-full">
                      {m.contextTag && (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold bg-indigo-950/70 text-indigo-300 border border-indigo-800/50">
                          <GraduationCap size={12} />
                          <span>{m.contextTag}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2.5 max-w-[85%]">
                        <div className="bg-[#2d2e36] text-white px-5 py-3 rounded-[20px] rounded-tr-md text-sm leading-relaxed border border-zinc-700/50 break-words">
                          {m.content}
                        </div>
                        {user?.avatar_url ? (
                          <img 
                            src={user.avatar_url} 
                            alt={user.full_name || 'User'} 
                            className="w-7 h-7 rounded-full object-cover shrink-0 border border-zinc-600 shadow-sm"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-zinc-700 text-white text-xs font-bold flex items-center justify-center shrink-0 border border-zinc-600 uppercase">
                            {user?.full_name?.slice(0, 1) || 'U'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div key={idx} className="flex flex-col space-y-2.5 w-full text-zinc-200">
                      {m.thought && (
                        <div className="border-b border-zinc-800/40 pb-1">
                          <button
                            type="button"
                            onClick={() => toggleThought(idx)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer py-1"
                          >
                            <Lightbulb size={13} className="text-amber-400/90" />
                            <span>Thought</span>
                            <ChevronRight size={13} className={`transition-transform duration-200 ${openThoughts[idx] ? 'rotate-90' : ''}`} />
                          </button>
                          <AnimatePresence>
                            {openThoughts[idx] && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-xs text-zinc-400 pl-4 pr-2 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800/80 my-1 font-mono"
                              >
                                {m.thought}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {m.contextTag && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <span className="text-zinc-500 font-mono">Analyzed</span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-800/80 text-zinc-200 border border-zinc-700/60 font-medium">
                            <BookOpen size={12} className="text-indigo-400" />
                            <span>{m.contextTag}</span>
                          </span>
                        </div>
                      )}

                      <div className="text-[14px] sm:text-[15px] leading-relaxed text-zinc-200 w-full">
                        <div className="markdown-body break-words prose prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-[#18191e] prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl">
                          <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                        </div>
                      </div>
                    </div>
                  );
                }
              })}

              {isTyping && messages[messages.length - 1]?.role !== 'model' && (
                <div className="flex items-center gap-3 py-2 text-xs text-zinc-400">
                  <div className="w-4 h-4 rounded-full border-2 border-zinc-300 border-t-transparent animate-spin shrink-0" />
                  <span className="font-medium animate-pulse">Analyzing topic details...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Card Container */}
            <form
              onSubmit={handleSend}
              className="p-3 sm:p-4 border-t border-zinc-800/80 bg-[#141416] flex flex-col gap-2 shrink-0 select-text"
            >
              <div className="bg-[#1c1d22] border border-zinc-800 rounded-[22px] p-2.5 shadow-xl flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Kortex AI about this topic..."
                  className="flex-1 bg-transparent border-none px-2 py-1.5 text-sm text-white focus:outline-none placeholder:text-zinc-500"
                />

                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                    isRecording 
                      ? 'bg-rose-500 text-white animate-pulse' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                  title={isRecording ? "Stop Voice Input" : "Voice Input"}
                >
                  <Mic size={16} />
                </button>

                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                    input.trim() && !isTyping 
                      ? 'bg-white hover:bg-zinc-200 text-zinc-900 shadow-md active:scale-95' 
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                  title="Send Message"
                >
                  <ArrowUp size={16} className="stroke-[2.5]" />
                </button>
              </div>

              <div className="flex items-center justify-between px-3 text-[10px] text-zinc-500 font-mono">
                <span>Swipe down to close drawer</span>
                <span>{user?.department || 'Computer Science'} • {user?.level || 'ND 1'}</span>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

