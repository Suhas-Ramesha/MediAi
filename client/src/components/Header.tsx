import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BookOpen, Shield, MessageSquare, Zap, HelpCircle,
  LayoutDashboard, CalendarCheck, BookHeart, History,
  Settings, LogOut, User, ChevronDown, Menu, X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import SparkWrapper from "./SparkWrapper";
import { ThemeToggle } from "./ThemeToggle";

interface UserType {
  name: string;
  email: string;
  profileImage?: string;
}

interface HeaderProps {
  user: UserType;
  onStartTour?: () => void;
}

const navLinks = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Appointments", path: "/appointments", icon: CalendarCheck },
  { label: "Symptom Diary", path: "/symptom-diary", icon: BookHeart },
  { label: "History", path: "/medical-history", icon: History },
];

export default function Header({ user, onStartTour }: HeaderProps) {
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged out successfully", description: "See you soon!" });
      setLocation("/");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Logout failed", description: error.message });
    }
  };

  const navTo = (path: string) => setLocation(path);

  return (
    <>
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-50"
      >
        <div className="transition-all duration-500">
          <motion.div
            animate={{ boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.15)" : "0 1px 8px rgba(0,0,0,0.06)" }}
            transition={{ duration: 0.3 }}
            className="glass-card border-b border-white/20 dark:border-white/5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl"
          >
            <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 flex items-center justify-between h-14">

              {/* ── Logo ── */}
              <SparkWrapper
                className="flex items-center gap-2.5 cursor-pointer group logo-container shrink-0"
                onClick={() => navTo("/dashboard")}
              >
                <motion.div
                  whileHover={{ scale: 1.08, rotate: -6 }}
                  transition={{ type: "spring", stiffness: 400 }}
                  className="p-1.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/20 dark:border-white/10"
                >
                  <svg className="h-6 w-6 text-indigo-500 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </motion.div>
                <span className="text-lg font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500 dark:from-indigo-400 dark:to-cyan-400">
                  MediAI
                </span>
              </SparkWrapper>

              {/* ── Desktop Nav ── */}
              <nav className="hidden lg:flex items-center justify-center gap-0.5">
                {navLinks.map((link, i) => {
                  const active = location === link.path || location.startsWith(link.path + "/");
                  return (
                    <motion.button
                      key={link.path}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * i, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      onClick={() => navTo(link.path)}
                      className={cn(
                        "relative px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors duration-200",
                        active
                          ? "text-indigo-600 dark:text-cyan-400"
                          : "text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-cyan-400"
                      )}
                    >
                      {link.label}
                      {active && (
                        <motion.span
                          layoutId="nav-indicator"
                          className="absolute inset-0 rounded-xl bg-indigo-50 dark:bg-cyan-500/10 border border-indigo-200/60 dark:border-cyan-500/20 -z-10"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                    </motion.button>
                  );
                })}
              </nav>

              {/* ── Right side actions ── */}
              <div className="flex items-center gap-2 shrink-0">
                <ThemeToggle />

                {/* Help dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-white transition-colors"
                    >
                      <HelpCircle className="h-5 w-5" />
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80 glass-card rounded-2xl p-4 border border-white/30 dark:border-white/10 shadow-2xl mt-2">
                    <DropdownMenuLabel className="text-base font-semibold dark:text-white mb-3 flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-indigo-500 dark:text-cyan-400" />
                      Quick Help
                    </DropdownMenuLabel>
                    <div className="space-y-3">
                      {[
                        { icon: MessageSquare, color: "blue", title: "Chat with MediAI", desc: "Describe symptoms via text, voice, or image upload." },
                        { icon: BookOpen, color: "purple", title: "Medical History", desc: "Browse past consultations and health records." },
                        { icon: Zap, color: "green", title: "Quick Tip", desc: "Include symptom duration and severity for better analysis." },
                        { icon: Shield, color: "red", title: "Privacy & Security", desc: "All data is end-to-end encrypted at rest and in transit." },
                      ].map(({ icon: Icon, color, title, desc }) => (
                        <div key={title} className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-lg bg-${color}-50 dark:bg-${color}-900/30 shrink-0`}>
                            <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{title}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <DropdownMenuSeparator className="my-3 bg-slate-200/50 dark:bg-slate-700/50" />
                    <DropdownMenuItem onClick={onStartTour} className="text-sm rounded-xl text-indigo-600 dark:text-cyan-400 focus:bg-indigo-50 dark:focus:bg-cyan-500/10 cursor-pointer">
                      Take the guided tour →
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* User profile dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors user-menu focus:outline-none"
                    >
                      {user.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt={user.name}
                          className="h-8 w-8 rounded-lg object-cover ring-2 ring-indigo-500/30 dark:ring-cyan-400/30"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[80px] truncate">
                        {user.name.split(" ")[0]}
                      </span>
                      <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                    </motion.button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 glass-card rounded-2xl shadow-2xl border border-white/30 dark:border-white/10 mt-2 overflow-hidden">
                    <div className="px-3 pt-3 pb-2">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator className="bg-slate-200/50 dark:bg-slate-700/50" />
                    {[
                      { label: "Profile", path: "/profile", icon: User },
                      { label: "Appointments", path: "/appointments", icon: CalendarCheck },
                      { label: "Symptom Diary", path: "/symptom-diary", icon: BookHeart },
                      { label: "Settings", path: "/settings", icon: Settings },
                    ].map(({ label, path, icon: Icon }) => (
                      <DropdownMenuItem
                        key={path}
                        onClick={() => navTo(path)}
                        className="flex items-center gap-2.5 mx-1 my-0.5 rounded-xl text-sm text-slate-700 dark:text-slate-200 focus:bg-slate-100 dark:focus:bg-slate-800/60 cursor-pointer"
                      >
                        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                        {label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator className="bg-slate-200/50 dark:bg-slate-700/50 my-1" />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="flex items-center gap-2.5 mx-1 mb-1 rounded-xl text-sm text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Mobile hamburger */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setMobileOpen(o => !o)}
                  className="lg:hidden h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {mobileOpen
                      ? <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}><X className="h-5 w-5" /></motion.span>
                      : <motion.span key="m" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}><Menu className="h-5 w-5" /></motion.span>
                    }
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.header>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden sticky top-14 z-40 overflow-hidden border-b border-white/10 dark:border-white/5"
          >
            <div className="glass-card rounded-2xl border border-white/30 dark:border-white/10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-3 space-y-1 shadow-xl">
              {navLinks.map((link, i) => {
                const active = location === link.path;
                return (
                  <motion.button
                    key={link.path}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i }}
                    onClick={() => navTo(link.path)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "bg-indigo-50 dark:bg-cyan-500/10 text-indigo-600 dark:text-cyan-400"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
