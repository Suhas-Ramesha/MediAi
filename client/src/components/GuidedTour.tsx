import { useEffect, useState } from "react";
import Joyride, {
  CallBackProps,
  STATUS,
  Step,
  TooltipRenderProps,
} from "react-joyride";
import { motion } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { transition } from "@/lib/motion";

interface GuidedTourProps {
  forceStart?: boolean;
}

const steps: Step[] = [
  {
    target: ".logo-container",
    title: "Welcome to MediAI",
    content:
      "This is your dashboard. A short walkthrough of the main areas.",
    placement: "bottom",
    disableBeacon: true,
  },
  {
    target: ".user-profile-section",
    title: "Your health profile",
    content:
      "Age, blood type, and allergies live here so consultations stay contextual.",
    placement: "right",
  },
  {
    target: ".recent-consultations",
    title: "Consultation history",
    content: "Open a previous chat to continue where you left off.",
    placement: "right",
  },
  {
    target: ".chat-interface",
    title: "Medical assistant",
    content:
      "Describe symptoms by text, voice, or upload. Risk assessments start from a new session.",
    placement: "left",
  },
  {
    target: ".user-menu",
    title: "Account menu",
    content: "Profile, appointments, diary, and settings are one click away.",
    placement: "bottom",
  },
];

function CustomTooltip({
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
  isLastStep,
}: TooltipRenderProps) {
  return (
    <motion.div
      {...tooltipProps}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.slow}
      className="surface-raised relative max-w-sm p-5"
    >
      <button
        {...closeProps}
        aria-label="Close tour"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mt-1 space-y-2 pr-6">
        {step.title ? (
          <h3 className="text-base font-semibold tracking-tight">{step.title}</h3>
        ) : null}
        <p className="text-sm leading-relaxed text-muted-foreground">
          {step.content}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {index + 1} / {steps.length}
        </span>
        <div className="flex items-center gap-2">
          {index > 0 ? (
            <Button variant="ghost" size="sm" {...backProps}>
              Back
            </Button>
          ) : null}
          <Button size="sm" {...primaryProps}>
            {isLastStep ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function GuidedTour({ forceStart = false }: GuidedTourProps) {
  const [run, setRun] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    const hasSeenTour = localStorage.getItem("hasSeenTour");
    if ((!hasSeenTour && currentUser) || forceStart) {
      setRun(true);
    }
  }, [currentUser, forceStart]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      if (!forceStart) {
        localStorage.setItem("hasSeenTour", "true");
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
      floaterProps={{ disableAnimation: true }}
      styles={{
        options: {
          arrowColor: "transparent",
          overlayColor: "hsl(var(--foreground) / 0.45)",
          zIndex: 1000,
        },
      }}
      callback={handleJoyrideCallback}
    />
  );
}
