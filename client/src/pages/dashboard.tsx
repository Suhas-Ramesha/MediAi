import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { useConsultations } from "@/hooks/useFirebase";
import { useRequireAuth } from "@/hooks/use-auth";
import { AppShell, PageSkeleton } from "@/components/AppShell";
import GuidedTour from "@/components/GuidedTour";
import MedicalChat from "@/components/MedicalChat";
import RecentConsultations from "@/components/RecentConsultations";
import UserProfile from "@/components/UserProfile";
import { Consultation } from "@/lib/types";
import { slideIn, transition } from "@/lib/motion";

function formatArrayField(field: unknown): string {
  if (!field) return "";
  if (Array.isArray(field)) return field.join(", ");
  if (typeof field === "string") return field;
  return "";
}

function DashboardContent({
  userProfile,
  consultations,
  forceStart,
}: {
  userProfile: any;
  consultations: Consultation[];
  forceStart: boolean;
}) {
  const [selectedConsultation, setSelectedConsultation] =
    useState<Consultation | null>(null);
  const reduceMotion = useReducedMotion();
  const firstName = (userProfile?.name || "User").split(" ")[0];

  return (
    <>
      <GuidedTour forceStart={forceStart} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition.slow}
        className="mb-6"
      >
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Good to see you, {firstName}
        </h1>
        <p className="mt-2 max-w-[48ch] text-muted-foreground">
          Describe how you feel, run a risk assessment, or pick up a previous
          consultation.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          variants={reduceMotion ? undefined : slideIn("left")}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="space-y-6 lg:col-span-1"
        >
          <section className="user-profile-section surface p-6">
            <p className="mb-4 font-display text-xl italic text-primary">Patient file</p>
            <UserProfile user={userProfile || {}} />
          </section>

          <section className="recent-consultations surface p-6">
            <RecentConsultations
              consultations={consultations}
              onSelectChat={setSelectedConsultation}
            />
          </section>
        </motion.div>

        <motion.div
          variants={reduceMotion ? undefined : slideIn("right")}
          initial={reduceMotion ? false : "hidden"}
          animate="visible"
          className="relative h-[calc(100vh-13rem)] min-h-[600px] lg:col-span-2"
        >
          <MedicalChat selectedConsultation={selectedConsultation} />
        </motion.div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { currentUser, userProfile, isLoading } = useRequireAuth();
  const [forceStartTour, setForceStartTour] = useState(false);

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

  if (isLoading || !currentUser || isLoadingConsultations) {
    return <PageSkeleton wide />;
  }

  const headerUser = {
    name: userProfile?.name || "User",
    email: userProfile?.email || "",
    profileImage: userProfile?.photoURL || undefined,
  };

  return (
    <AppShell
      user={headerUser}
      wide
      showFooter={false}
      onStartTour={() => setForceStartTour(true)}
    >
      <DashboardContent
        userProfile={userProfile}
        consultations={formattedConsultations}
        forceStart={forceStartTour}
      />
    </AppShell>
  );
}
