import React, { useState, useEffect } from 'react';
import Joyride, { Step, CallBackProps, STATUS, TooltipRenderProps } from 'react-joyride';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface GuidedTourProps {
  forceStart?: boolean;
}

const steps: Step[] = [
  {
    target: '.logo-container',
    title: 'Welcome to MediAI',
    content: 'This is your dashboard. Let me show you around to get you familiar with our intelligent healthcare platform.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.user-profile-section',
    title: 'Your Health Profile',
    content: 'Here you can view and manage your profile information, including allergies and vital stats.',
    placement: 'right',
  },
  {
    target: '.recent-consultations',
    title: 'Consultation History',
    content: 'Your recent medical consultations are listed here. Click on any to view detailed insights.',
    placement: 'right',
  },
  {
    target: '.chat-interface',
    title: 'Intelligent Analysis',
    content: 'This is where you can chat with MediAI. Describe your symptoms, and our AI will help analyze them instantly.',
    placement: 'left',
  },
  {
    target: '.user-menu',
    title: 'Quick Access',
    content: 'Access your profile, medical history, and account settings directly from here.',
    placement: 'bottom',
  },
];

const CustomTooltip = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps) => {
  return (
    <motion.div
      {...tooltipProps}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="glass-card bg-white/80 dark:bg-slate-900/80 rounded-2xl p-6 shadow-2xl border border-white/40 dark:border-white/10 max-w-sm backdrop-blur-xl relative"
    >
      <button 
        {...closeProps}
        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-2 mt-2">
        {step.title && <h3 className="text-xl font-bold dark:text-white text-slate-900 tracking-tight">{step.title}</h3>}
        <p className="text-sm dark:text-slate-300 text-slate-600 leading-relaxed">{step.content}</p>
      </div>

      <div className="flex items-center justify-between mt-8">
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mr-2">
            Step {index + 1} of {steps.length}
          </span>
          {index > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8 px-3 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-800/50" {...backProps}>
              Back
            </Button>
          )}
        </div>
        <Button size="sm" className="h-8 rounded-full px-4 text-xs font-medium" {...primaryProps}>
          {isLastStep ? 'Finish Tour' : 'Next'}
        </Button>
      </div>
    </motion.div>
  );
};

export default function GuidedTour({ forceStart = false }: GuidedTourProps) {
  const [run, setRun] = useState(false);
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Check if user has seen the tour before
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if ((!hasSeenTour && currentUser) || forceStart) {
      setRun(true);
    }
  }, [currentUser, forceStart]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      if (!forceStart) {
        localStorage.setItem('hasSeenTour', 'true');
      }
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress={false}
      showSkipButton={false}
      tooltipComponent={CustomTooltip}
      floaterProps={{
        disableAnimation: true, // We handle animation in CustomTooltip
      }}
      styles={{
        options: {
          arrowColor: 'transparent', // Hide default arrow as glass-card makes it tricky
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        },
      }}
      callback={handleJoyrideCallback}
    />
  );
}