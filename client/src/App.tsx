import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/profile";
import MedicalHistory from "@/pages/medical-history";
import Settings from "@/pages/settings";
import { AuthProvider } from "@/hooks/use-auth";
import SymptomDiaryPage from "@/app/symptom-diary/page";
import Appointments from "@/pages/appointments";
import { ThemeProvider } from "@/components/theme-provider";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/profile" component={Profile} />
      <Route path="/medical-history" component={MedicalHistory} />
      <Route path="/symptom-diary" component={SymptomDiaryPage} />
      <Route path="/settings" component={Settings} />
      <Route path="/appointments" component={Appointments} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Main App component
function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="mediai-theme">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
