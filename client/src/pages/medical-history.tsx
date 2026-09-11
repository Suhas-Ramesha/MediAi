import React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import RecentConsultations from "@/components/RecentConsultations";
import { useConsultations } from "@/hooks/useFirebase";
import { Consultation } from "@/lib/types";

export default function MedicalHistory() {
  const { currentUser, userProfile, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Fetch consultations
  const { data: consultations = [], isLoading: isLoadingConsultations } = useConsultations(
    currentUser?.uid
  );

  // Redirect to landing page if not logged in
  React.useEffect(() => {
    if (!isLoading && !currentUser) {
      setLocation("/");
    }
  }, [isLoading, currentUser, setLocation]);

  // Show loading state if authentication is still loading
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Redirect if no user is logged in
  if (!currentUser) {
    return <div className="flex items-center justify-center min-h-screen">Redirecting...</div>;
  }

  // Show loading state while consultations are being fetched
  if (isLoadingConsultations) {
    return <div className="flex items-center justify-center min-h-screen">Loading data...</div>;
  }

  const headerUser = {
    name: userProfile?.name || "User",
    email: userProfile?.email || "",
    profileImage: userProfile?.photoURL || undefined
  };

  // Format consultations for display
  const formattedConsultations: Consultation[] = consultations.map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    date: c.date instanceof Date ? c.date.toISOString().split('T')[0] : String(c.date)
  }));

  const handleSelectChat = (consultation: Consultation) => {
    setLocation(`/dashboard?consultation=${consultation.id}`);
  };

  return (
    <div className="bg-slate-100 min-h-screen flex flex-col text-slate-800">
      <Header user={headerUser} />
      
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Medical History</h1>
        
        <Card>
          <CardContent className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Consultations</h2>
            <RecentConsultations 
              consultations={formattedConsultations}
              onSelectChat={handleSelectChat}
            />
            <a href="/my-medicines" className="mt-4 inline-block text-sm text-primary">
              Open cross-doctor medicine list
            </a>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
} 