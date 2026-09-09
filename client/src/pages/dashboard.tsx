import React, { useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

import { useAuth } from "@/hooks/use-auth";
import Header from "@/components/Header";
import UserProfile from "@/components/UserProfile";
import RecentConsultations from "@/components/RecentConsultations";
import MedicalChat from "@/components/MedicalChat";
import GuidedTour from "@/components/GuidedTour";
import { Skeleton } from "@/components/ui/skeleton";
import { useConsultations } from "@/hooks/useFirebase";
import { Consultation } from "@/lib/types";
import { slideIn, transition } from "@/lib/motion";

function DashboardContent({
  userProfile,
  consultations,
}: {
  userProfile: any;
  consultations: Consultation[];
}) {
  const [selectedConsultation, setSelectedConsultation] =
    useState<Consultation | null>(null);
  const [showTour, setShowTour] = useState(false);

  const handleSelectChat = (consultation: Consultation) => {
    setSelectedConsultation(consultation);
  };

  const headerUser = {
    name: userProfile?.name || "User",
    email: userProfile?.email || "",
    profileImage: userProfile?.photoURL || undefined,
  };

  const firstName = headerUser.name.split(" ")[0];

  return (
    <div className="min-h-screen bg-background">
      <GuidedTour forceStart={showTour} />

      <Header user={headerUser} onStartTour={() => setShowTour(true)} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition.slow}
          className="mb-6"
        >
          <h1 className="text-2xl font-semibold tracking-tight">
            Good to see you, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Describe how you feel, run a risk assessment, or pick up a previous
            consultation.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column */}
          <motion.div
            variants={slideIn("left")}
            initial="hidden"
            animate="visible"
            className="space-y-6 lg:col-span-1"
          >
            <section className="user-profile-section surface p-6">
              <UserProfile user={userProfile || {}} />
            </section>

            <section className="recent-consultations surface p-6">
              <RecentConsultations
                consultations={consultations}
                onSelectChat={handleSelectChat}
              />
            </section>
          </motion.div>

          {/* Chat column */}
          <motion.div
            variants={slideIn("right")}
            initial="hidden"
            animate="visible"
            className="relative h-[calc(100vh-13rem)] min-h-[600px] lg:col-span-2"
          >
            <MedicalChat selectedConsultation={selectedConsultation} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}

/** Designed loading state, rather than the word "Loading". */
function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-14 border-b border-border" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="surface space-y-4 p-6">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <div className="surface space-y-3 p-6">
              <Skeleton className="h-4 w-40" />
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="surface h-[calc(100vh-13rem)] min-h-[600px] p-6">
              <Skeleton className="h-5 w-48" />
              <div className="mt-6 space-y-4">
                <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
                <Skeleton className="h-24 w-4/5 rounded-2xl" />
                <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const formatArrayField = (field: any): string => {
  if (!field) return "";
  if (Array.isArray(field)) return field.join(", ");
  if (typeof field === "string") return field;
  return "";
};

export default function Dashboard() {
  const { currentUser, userProfile, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: consultations = [], isLoading: isLoadingConsultations } =
    useConsultations(currentUser?.uid);

  const formattedConsultations: Consultation[] = consultations.map((c) => ({
    id: c.id,
    chatId: c.id,
    title: c.title,
    date: c.date instanceof Date ? c.date : new Date(c.date),
    status: c.status === "ongoing" ? "active" : "completed",
    userId: currentUser?.uid || "",
    messages: [],
    symptoms: formatArrayField(c.symptoms),
    diagnosis: c.diagnosis || "",
    recommendations: formatArrayField(c.recommendations),
  }));

  React.useEffect(() => {
    if (!isLoading && !currentUser) {
      setLocation("/");
    }
  }, [isLoading, currentUser, setLocation]);

  if (isLoading || (currentUser && isLoadingConsultations)) {
    return <DashboardSkeleton />;
  }

  if (!currentUser) {
    return <DashboardSkeleton />;
  }

  return (
    <DashboardContent
      userProfile={userProfile}
      consultations={formattedConsultations}
    />
  );
}
