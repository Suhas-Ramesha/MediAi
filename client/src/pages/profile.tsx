import { useRequireAuth } from "@/hooks/use-auth";
import { AppShell, PageSkeleton } from "@/components/AppShell";
import UserProfile from "@/components/UserProfile";

export default function Profile() {
  const { currentUser, userProfile, isLoading } = useRequireAuth();

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
      title="Your profile"
      description="Keep the details a clinician would ask for up to date."
    >
      <div className="surface p-6">
        <UserProfile user={userProfile || {}} />
      </div>
    </AppShell>
  );
}
