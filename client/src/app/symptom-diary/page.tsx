import React from 'react';
import { SymptomDiary } from '@/components/SymptomDiary';
import { useAuth } from '@/hooks/use-auth';
import { useLocation } from 'wouter';
import Header from '@/components/Header';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

export default function SymptomDiaryPage() {
  const { userProfile } = useAuth();
  const [, setLocation] = useLocation();

  const headerUser = {
    name: userProfile?.name || 'User',
    email: userProfile?.email || '',
    profileImage: userProfile?.photoURL || undefined,
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Header user={headerUser} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => setLocation('/dashboard')}
          className="group mb-6 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </motion.button>
        <SymptomDiary />
      </main>
    </div>
  );
}