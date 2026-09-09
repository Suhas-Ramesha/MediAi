import { useState } from "react";

import { useRequireAuth } from "@/hooks/use-auth";
import { AppShell, PageSkeleton } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { currentUser, userProfile, updateEmail, updatePassword, isLoading } =
    useRequireAuth();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  if (isLoading || !currentUser) {
    return <PageSkeleton />;
  }

  const headerUser = {
    name: userProfile?.name || "User",
    email: userProfile?.email || "",
    profileImage: userProfile?.photoURL || undefined,
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.currentPassword) {
      toast({
        variant: "destructive",
        title: "Required fields missing",
        description: "Enter a new email and your current password.",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updateEmail(formData.email, formData.currentPassword);
      setVerificationSent(true);
      toast({
        title: "Verification email sent",
        description:
          "Check the new address for a link. The email updates after you confirm it.",
      });
      setFormData((prev) => ({ ...prev, email: "", currentPassword: "" }));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description:
          error.message || "Could not update email. Try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.currentPassword ||
      !formData.newPassword ||
      !formData.confirmPassword
    ) {
      toast({
        variant: "destructive",
        title: "Required fields missing",
        description: "Fill in all password fields.",
      });
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        variant: "destructive",
        title: "Passwords don't match",
        description: "New password and confirmation must match.",
      });
      return;
    }

    setIsUpdating(true);
    try {
      await updatePassword(formData.currentPassword, formData.newPassword);
      toast({
        title: "Password updated",
        description: "Your password has been updated.",
      });
      setFormData((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description:
          error.message || "Could not update password. Try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AppShell
      user={headerUser}
      title="Settings"
      description="Account email and password. These changes take effect after confirmation."
    >
      <div className="space-y-6">
        <section className="surface p-6">
          <h2 className="mb-4 text-base font-semibold">Update email</h2>
          {verificationSent ? (
            <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <p className="font-medium">Verification email sent</p>
              <p className="mt-1 text-muted-foreground">
                Open the link in the new inbox. The address on this account
                updates after you confirm it.
              </p>
            </div>
          ) : (
            <form onSubmit={handleUpdateEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">New email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="you@email.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleInputChange}
                  placeholder="Current password"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? "Sending…" : "Update email"}
              </Button>
            </form>
          )}
        </section>

        <section className="surface p-6">
          <h2 className="mb-4 text-base font-semibold">Update password</h2>
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPasswordForNew">Current password</Label>
              <Input
                id="currentPasswordForNew"
                name="currentPassword"
                type="password"
                value={formData.currentPassword}
                onChange={handleInputChange}
                placeholder="Current password"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={handleInputChange}
                placeholder="New password"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" disabled={isUpdating}>
              {isUpdating ? "Updating…" : "Update password"}
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
