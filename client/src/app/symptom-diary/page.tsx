import { useLocation } from "wouter";

import { SymptomDiary } from "@/components/SymptomDiary";
import { useRequireAuth } from "@/hooks/use-auth";
import { AppShell, PageSkeleton } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export default function SymptomDiaryPage() {
  const { currentUser, userProfile, isLoading } = useRequireAuth();
  const [, setLocation] = useLocation();

  if (isLoading || !currentUser) {
    return <PageSkeleton />;
  }

  const headerUser = {
    name: userProfile?.name || "User",
    email: userProfile?.email || "",
    profileImage: userProfile?.photoURL || undefined,
  };

  return (
    <AppShell
      user={headerUser}
      title="Symptom diary"
      description="Log how you feel over days. Patterns show up here that a single chat cannot."
    >
      <Button
        variant="ghost"
        className="mb-4 -ml-2 text-muted-foreground"
        onClick={() => setLocation("/dashboard")}
      >
        Back to dashboard
      </Button>
      <SymptomDiary />
    </AppShell>
  );
}
