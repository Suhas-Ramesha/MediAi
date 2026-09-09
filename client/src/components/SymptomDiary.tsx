import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, AlertCircle, BookHeart, Send, PlusCircle, Thermometer, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

interface SymptomLog {
  id: string;
  userId: string;
  symptom: string;
  severity?: number;
  timestamp: Date;
}

const severityLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Mild', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  2: { label: 'Moderate', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  3: { label: 'Severe', color: 'text-red-500 bg-red-500/10 border-red-500/20' },
};

export function SymptomDiary() {
  const { currentUser } = useAuth();
  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [severity, setSeverity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  const fetchLogs = async () => {
    if (!currentUser) { setIsLoading(false); setLogs([]); return; }
    setIsLoading(true);
    setError(null);
    try {
      const logsCollection = collection(db, 'symptomLogs');
      const q = query(logsCollection, where('userId', '==', currentUser.uid), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedLogs: SymptomLog[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date();
        fetchedLogs.push({ id: doc.id, userId: data.userId, symptom: data.symptom, severity: data.severity ?? 1, timestamp });
      });
      setLogs(fetchedLogs);
    } catch (err) {
      console.error("Error fetching symptom logs:", err);
      setError("Failed to load symptom diary. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [currentUser]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !currentUser || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'symptomLogs'), {
        userId: currentUser.uid,
        symptom: input.trim(),
        severity,
        timestamp: Timestamp.now(),
      });
      setInput('');
      setSeverity(1);
      toast({ title: 'Symptom logged', description: 'Your symptom has been saved to your diary.' });
      await fetchLogs();
    } catch (err) {
      console.error('Error saving symptom:', err);
      toast({ variant: 'destructive', title: 'Failed to save', description: 'Could not log your symptom. Try again.' });
    } finally {
      setIsSubmitting(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  };

  const formatDate = (date: Date): string =>
    date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/20">
          <BookHeart className="h-6 w-6 text-indigo-500 dark:text-cyan-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Symptom Diary</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{logs.length} {logs.length === 1 ? 'entry' : 'entries'} recorded</p>
        </div>
      </motion.div>

      {/* Input Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="glass-card rounded-2xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-white/5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <PlusCircle className="h-4 w-4 text-indigo-500 dark:text-cyan-400" />
            Log a new symptom
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your symptom in detail… (e.g. 'Sharp headache behind my eyes, worse when moving')"
            rows={3}
            className="w-full resize-none rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:focus:ring-cyan-400/40 transition-all"
          />

          {/* Severity selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
              <Thermometer className="h-3.5 w-3.5" /> Severity
            </span>
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(lvl => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSeverity(lvl)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                    severity === lvl
                      ? severityLabels[lvl].color + ' shadow-sm scale-105'
                      : 'text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {severityLabels[lvl].label}
                </button>
              ))}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              disabled={!input.trim() || isSubmitting}
              className="ml-auto flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-400 text-white text-sm font-medium shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? 'Saving…' : 'Log Symptom'}
            </motion.button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono border border-slate-200 dark:border-slate-700">Enter</kbd> to submit quickly.</p>
        </form>
      </motion.div>

      {/* Log List */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="glass-card rounded-2xl border border-white/30 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl shadow-lg overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 dark:border-white/5">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500 dark:text-cyan-400" />
            Your logged symptoms
          </p>
        </div>
        <ScrollArea className="h-[380px]">
          <div className="p-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500 dark:text-cyan-400" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">Loading diary…</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-48 text-red-500 gap-2">
                <AlertCircle className="h-8 w-8" />
                <p className="text-sm">{error}</p>
              </div>
            ) : !currentUser ? (
              <div className="flex items-center justify-center h-48 text-slate-400">
                Please log in to view your symptom diary.
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <BookHeart className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">No symptoms logged yet. Use the input above to record your first entry.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                <div className="space-y-3">
                  {logs.map((log, i) => {
                    const sev = severityLabels[log.severity ?? 1];
                    return (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-white/5 flex flex-col gap-2"
                      >
                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-snug">{log.symptom}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sev.color}`}>{sev.label}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </div>
  );
}