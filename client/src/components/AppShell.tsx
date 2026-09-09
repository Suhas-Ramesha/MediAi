import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { transition } from "@/lib/motion";

type HeaderUser = {
  name: string;
  email: string;
  profileImage?: string;
};

type AppShellProps = {
  user: HeaderUser;
  title?: string;
  description?: string;
  children: ReactNode;
  onStartTour?: () => void;
  wide?: boolean;
  showFooter?: boolean;
};

export function AppShell({
  user,
  title,
  description,
  children,
  onStartTour,
  wide = false,
  showFooter = true,
}: AppShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header user={user} onStartTour={onStartTour} />
      <motion.main
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition.slow}
        className={cn(
          "mx-auto w-full flex-1 px-4 py-8 sm:px-6 lg:px-8",
          wide ? "max-w-7xl" : "max-w-3xl",
        )}
      >
        {title ? (
          <header className="mb-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <p className="mt-2 max-w-[52ch] text-muted-foreground">{description}</p>
            ) : null}
          </header>
        ) : null}
        {children}
      </motion.main>
      {showFooter ? <Footer /> : null}
    </div>
  );
}

export function PageSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-14 border-b border-border" />
      <main
        className={cn(
          "mx-auto w-full px-4 py-8 sm:px-6 lg:px-8",
          wide ? "max-w-7xl" : "max-w-3xl",
        )}
      >
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </main>
    </div>
  );
}
