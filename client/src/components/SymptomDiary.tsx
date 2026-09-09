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
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <BookHeart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Symptom diary</h1>
          <p className="text-sm text-muted-foreground">{logs.length} {logs.length === 1 ? 'entry' : 'entries'} recorded</p>
        </div>
      </motion.div>

      {/* Input Card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="surface overflow-hidden"
      >
        <div className="border-b border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <PlusCircle className="h-4 w-4 text-primary" />
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
            className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm text-foreground transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          />

          {/* Severity selector */}
          <div className="flex items-center gap-3">
            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
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
                      ? severityLabels[lvl].color + ' shadow-xs'
                      : 'border-border text-muted-foreground hover:border-foreground/25 hover:text-foreground'
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
              className="ml-auto flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-opacity duration-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? 'Saving…' : 'Log symptom'}
            </motion.button>
          </div>
          <p className="text-xs text-muted-foreground">Press <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">Enter</kbd> to submit quickly.</p>
        </form>
      </motion.div>

      {/* Log List */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="surface overflow-hidden"
      >
        <div className="border-b border-border p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" />
            Your logged symptoms
          </p>
        </div>
        <ScrollArea className="h-[380px]">
          <div className="p-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-7 w-7 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading diary…</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-destructive">
                <AlertCircle className="h-7 w-7" />
                <p className="text-sm">{error}</p>
              </div>
            ) : !currentUser ? (
              <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                Please sign in to view your symptom diary.
              </div>
            ) : logs.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-3 text-center">
                <BookHeart className="h-9 w-9 text-muted-foreground/40" />
                <p className="max-w-xs text-sm text-muted-foreground">No symptoms logged yet. Use the input above to record your first entry.</p>
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
                        className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4"
                      >
                        <p className="text-sm leading-snug">{log.symptom}</p>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sev.color}`}>{sev.label}</span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
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