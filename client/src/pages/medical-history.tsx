import { useLocation } from "wouter";

import { useRequireAuth } from "@/hooks/use-auth";
import { AppShell, PageSkeleton } from "@/components/AppShell";
import RecentConsultations from "@/components/RecentConsultations";
import { useConsultations } from "@/hooks/useFirebase";
import { Consultation } from "@/lib/types";

export default function MedicalHistory() {
  const { currentUser, userProfile, isLoading } = useRequireAuth();
  const [, setLocation] = useLocation();
  const { data: consultations = [], isLoading: isLoadingConsultations } =
    useConsultations(currentUser?.uid);

  if (isLoading || !currentUser || isLoadingConsultations) {
    return <PageSkeleton />;
  }

  const headerUser = {
    name: userProfile?.name || "User",
    email: userProfile?.email || "",
    profileImage: userProfile?.photoURL || undefined,
  };

  const formattedConsultations: Consultation[] = consultations.map((c) => ({
    id: c.id,
    chatId: c.id,
    title: c.title,
    status: c.status === "ongoing" ? "active" : c.status,
    date: c.date instanceof Date ? c.date : new Date(c.date),
    userId: currentUser.uid,
    messages: [],
    symptoms: "",
    diagnosis: c.diagnosis || "",
    recommendations: "",
  }));

  const handleSelectChat = (consultation: Consultation) => {
    setLocation(`/dashboard?consultation=${consultation.id}`);
  };

  return (
    <AppShell
      user={headerUser}
      title="Medical history"
      description="Past consultations, kept on this account."
    >
      <section className="surface p-6">
        <RecentConsultations
          consultations={formattedConsultations}
          onSelectChat={handleSelectChat}
        />
      </section>
    </AppShell>
  );
}
