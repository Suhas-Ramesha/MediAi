import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookHeart,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  HelpCircle,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Pill,
  Settings,
  Shield,
  User,
  X,
  Zap,
} from "lucide-react";
import { useLocation } from "wouter";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { transition } from "@/lib/motion";
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
  { label: "My medicines", path: "/my-medicines", icon: Pill },
  { label: "Appointments", path: "/appointments", icon: CalendarCheck },
  { label: "Symptom Diary", path: "/symptom-diary", icon: BookHeart },
  { label: "History", path: "/medical-history", icon: History },
];

const accountLinks = [
  { label: "Profile", path: "/profile", icon: User },
  { label: "Appointments", path: "/appointments", icon: CalendarCheck },
  { label: "Symptom Diary", path: "/symptom-diary", icon: BookHeart },
  { label: "Settings", path: "/settings", icon: Settings },
];

const helpItems = [
  {
    icon: MessageSquare,
    title: "Chat with MediAI",
    desc: "Describe symptoms by text, voice, or image upload.",
  },
  {
    icon: BookOpen,
    title: "Medical history",
    desc: "Browse past consultations and saved assessments.",
  },
  {
    icon: Zap,
    title: "Getting better answers",
    desc: "Include how long it has lasted and how severe it feels.",
  },
  {
    icon: Shield,
    title: "Your data",
    desc: "Consultations are scoped to your account and visible only to you.",
  },
];

export default function Header({ user, onStartTour }: HeaderProps) {
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Signed out", description: "See you soon." });
      setLocation("/");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Sign out failed",
        description: error?.message,
      });
    }
  };

  const navTo = (path: string) => setLocation(path);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b transition-colors duration-base",
          scrolled
            ? "border-border bg-background/85 backdrop-blur-md"
            : "border-transparent bg-background",
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <SparkWrapper
            className="logo-container flex shrink-0 cursor-pointer items-center gap-2.5"
            onClick={() => navTo("/dashboard")}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </span>
            <span className="text-base font-semibold tracking-tight">
              MediAI
            </span>
          </SparkWrapper>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => {
              const active =
                location === link.path ||
                location.startsWith(link.path + "/");
              return (
                <button
                  key={link.path}
                  onClick={() => navTo(link.path)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative rounded-md px-3 py-2 text-sm font-medium transition-colors duration-fast",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right side */}
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />

            {/* Help */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  aria-label="Help"
                  className="hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground sm:flex"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-2">
                <DropdownMenuLabel className="px-2 text-sm font-semibold">
                  Quick help
                </DropdownMenuLabel>
                <div className="space-y-1 py-1">
                  {helpItems.map(({ icon: Icon, title, desc }) => (
                    <div
                      key={title}
                      className="flex items-start gap-3 rounded-md px-2 py-2"
                    >
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{title}</p>
                        <p className="text-xs leading-snug text-muted-foreground">
                          {desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {onStartTour && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onStartTour}
                      className="cursor-pointer text-sm font-medium text-primary"
                    >
                      Take the guided tour
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Account */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="user-menu flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors duration-fast hover:bg-accent">
                  {user.profileImage ? (
                    <img
                      src={user.profileImage}
                      alt=""
                      className="h-7 w-7 rounded-md object-cover"
                    />
                  ) : (
                    <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="hidden max-w-[90px] truncate text-sm font-medium sm:block">
                    {user.name.split(" ")[0]}
                  </span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                {accountLinks.map(({ label, path, icon: Icon }) => (
                  <DropdownMenuItem
                    key={label + path}
                    onClick={() => navTo(path)}
                    className="cursor-pointer gap-2.5 text-sm"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer gap-2.5 text-sm text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground lg:hidden"
            >
              {mobileOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={transition.base}
              className="overflow-hidden border-t border-border bg-background lg:hidden"
            >
              <nav className="space-y-1 px-4 py-3 sm:px-6">
                {navLinks.map((link) => {
                  const active = location === link.path;
                  return (
                    <button
                      key={link.path}
                      onClick={() => navTo(link.path)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-fast",
                        active
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <link.icon className="h-4 w-4" />
                      {link.label}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
