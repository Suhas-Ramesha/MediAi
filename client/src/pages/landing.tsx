import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  HeartPulse,
  Lock,
  MessageSquareText,
  Mic,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Reveal, RevealGroup, RevealItem, ScrollProgress } from "@/components/ui/reveal";
import { LoginForm, SignUpForm } from "@/components/AuthForms";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BioSphereCanvas3D } from "@/components/landing/BioSphereCanvas3D";
import { TiltCard } from "@/components/landing/TiltCard";
import { InteractiveConsoleDemo } from "@/components/landing/InteractiveConsoleDemo";
import { useAuth } from "@/hooks/use-auth";
import { fadeUp, scaleIn, transition } from "@/lib/motion";

export default function Landing() {
  const { currentUser, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState("login");
  const [navSolid, setNavSolid] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  // Scroll position tracking for nav blur & floating style
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setNavSolid(y > 20));

  const handleLoginSuccess = () => setLocation("/dashboard");

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground antialiased selection:bg-primary/20">
      <ScrollProgress />

      {/* ---------------- 1. Floating Island Navigation ---------------- */}
      <header className="fixed inset-x-0 top-3 z-50 px-4 sm:px-6">
        <nav
          className={`mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full border px-4 transition-all duration-300 sm:px-6 ${
            navSolid
              ? "border-border/80 bg-background/85 shadow-lg backdrop-blur-xl"
              : "border-border/40 bg-background/60 shadow-sm backdrop-blur-md"
          }`}
        >
          {/* Brand Logo with Live Pulse */}
          <button
            type="button"
            onClick={() => {
              setLocation("/");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="group flex cursor-pointer items-center gap-2.5 text-left transition-opacity hover:opacity-90"
          >
            <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-tr from-emerald-600 to-cyan-500 text-white shadow-md">
              <Stethoscope className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight">MediAI</span>
              <span className="hidden text-[9px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
                Clinical Intelligence
              </span>
            </div>
          </button>

          {/* Quick Nav Anchors */}
          <div className="hidden items-center gap-1 md:flex">
            {[
              ["Capabilities", "capabilities"],
              ["Interactive Console", "console"],
              ["Care Pathway", "how"],
              ["Access", "get-started"],
            ].map(([label, id]) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {currentUser ? (
              <Button
                size="sm"
                onClick={() => setLocation("/dashboard")}
                className="h-8 rounded-full px-4 text-xs font-semibold"
              >
                Dashboard
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => scrollToSection("get-started")}
                className="h-8 rounded-full px-4 text-xs font-semibold"
              >
                Sign In
              </Button>
            )}
          </div>
        </nav>
      </header>

      {/* ---------------- 2. Hero Section (3D + High-Impact Copy) ---------------- */}
      <section id="top" className="relative overflow-hidden pt-28 pb-16 lg:pt-36 lg:pb-24">
        {/* Soft atmospheric gradient glows */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-12 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[130px] dark:bg-emerald-500/15" />
          <div className="absolute top-48 right-1/4 h-[300px] w-[500px] rounded-full bg-cyan-500/10 blur-[110px] dark:bg-cyan-500/15" />
        </div>

        <div className="container-page grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Hero Left Content */}
          <div className="lg:col-span-7 space-y-6">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Clinical AI Triage & Multi-Agent Consilium
            </motion.div>

            <motion.h1
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-balance"
            >
              Next-Gen Medical Intelligence.{" "}
              <span className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 bg-clip-text text-transparent">
                Backed by Clinical Evidence.
              </span>
            </motion.h1>

            <motion.p
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.14 }}
              className="max-w-xl text-base text-muted-foreground sm:text-lg text-pretty leading-relaxed"
            >
              Instant AI triage, multi-agent reasoning, and validated risk scoring—before you step into the clinic.
            </motion.p>

            {/* CTAs with nested button-in-button design */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="flex flex-wrap items-center gap-3 pt-2"
            >
              {currentUser ? (
                <Button
                  size="lg"
                  onClick={() => setLocation("/dashboard")}
                  className="group relative h-12 rounded-full pl-6 pr-2 font-medium shadow-md transition-all hover:shadow-emerald-500/20"
                >
                  <span className="mr-3">Open Medical Console</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => scrollToSection("get-started")}
                  className="group relative h-12 rounded-full pl-6 pr-2 font-medium shadow-md transition-all hover:shadow-emerald-500/20"
                >
                  <span className="mr-3">Start Free AI Triage</span>
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Button>
              )}

              <Button
                size="lg"
                variant="outline"
                onClick={() => scrollToSection("console")}
                className="h-12 rounded-full border-border/80 px-6 font-medium backdrop-blur-xs transition-colors hover:bg-muted"
              >
                <Sparkles className="mr-2 h-4 w-4 text-emerald-500" />
                Explore 3D Console
              </Button>
            </motion.div>

            {/* Trust Validation Strip */}
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.28 }}
              className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4 text-xs text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>RxNorm Verified</span>
              </div>
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-cyan-500 shrink-0" />
                <span>Consilium Agents</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>4-Model Organ ML</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-cyan-500 shrink-0" />
                <span>End-to-End Private</span>
              </div>
            </motion.div>
          </div>

          {/* Hero Right: 3D WebGL BioSphere Hologram */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="w-full max-w-[28rem] aspect-square"
            >
              <BioSphereCanvas3D className="h-full w-full" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------------- 3. Interactive 4-Pillar Clinical Bento Grid ---------------- */}
      <section id="capabilities" className="scroll-mt-20 py-20 lg:py-28 border-y border-border/40 bg-muted/20">
        <div className="container-page space-y-12">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Clinical Capabilities</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Engineered for diagnostic accuracy.
            </h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              Every tool converges on actionable clinical outcomes: narrow differentials, catch medication clashes, and walk into appointments fully prepared.
            </p>
          </Reveal>

          {/* Bento Grid Architecture */}
          <div className="grid gap-5 md:grid-cols-3">
            {/* Bento Card 1: Differential Triage & Voice (Spans 2 cols) */}
            <div className="md:col-span-2">
              <TiltCard className="h-full rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <MessageSquareText className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-mono text-muted-foreground">
                    Speech & Text Intake
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-semibold tracking-tight">
                  Adaptive Differential Triage
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
                  Describe symptoms in your own colloquial words or voice. MediAI maps them to clinical SNOMED CT terminology and asks targeted follow-ups to rule out urgent red flags.
                </p>

                {/* Micro-preview pill inside card */}
                <div className="mt-6 rounded-xl border border-border/50 bg-muted/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                      Patient Voice Sample: "Persistent throbbing headache with stiff neck"
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">Mapped</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-md bg-background px-2.5 py-1 border border-border/60 font-mono">
                      [R51.9] Cephalea
                    </span>
                    <span className="rounded-md bg-background px-2.5 py-1 border border-border/60 font-mono">
                      [M54.2] Cervicalgia / Nuchal Rigidity
                    </span>
                    <span className="rounded-md bg-rose-500/10 text-rose-500 px-2.5 py-1 font-medium border border-rose-500/20">
                      Flag: Check Meningeal Signs
                    </span>
                  </div>
                </div>
              </TiltCard>
            </div>

            {/* Bento Card 2: 4-Organ Risk Scores (Spans 1 col) */}
            <div className="md:col-span-1">
              <TiltCard className="h-full rounded-2xl border border-border/70 bg-card p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                    <Activity className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">
                    Multi-Organ ML Risk
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Four validated machine-learning models assess diabetes, heart, renal, and liver projection curves.
                  </p>
                </div>

                <div className="mt-6 space-y-2.5 rounded-xl border border-border/50 bg-muted/30 p-3">
                  {[
                    { label: "Diabetes Risk", val: 38, col: "bg-emerald-500" },
                    { label: "Cardiometabolic", val: 24, col: "bg-teal-500" },
                    { label: "Renal Markers", val: 12, col: "bg-cyan-500" },
                  ].map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-foreground">{item.label}</span>
                        <span className="font-mono text-muted-foreground">{item.val}%</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted">
                        <div className={`h-full rounded-full ${item.col}`} style={{ width: `${item.val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </TiltCard>
            </div>

            {/* Bento Card 3: Prescription Guard (Spans 1 col) */}
            <div className="md:col-span-1">
              <TiltCard className="h-full rounded-2xl border border-border/70 bg-card p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Pill className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-xl font-semibold tracking-tight">
                    Prescription Guard
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    Reconciles medications across independent doctors into a single RxNorm ledger, flagging harmful interactions.
                  </p>
                </div>

                <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                    RxNorm Reconciled
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    3 active prescriptions audited against patient allergies. No dangerous CYP3A4 inhibitors detected.
                  </p>
                </div>
              </TiltCard>
            </div>

            {/* Bento Card 4: Doctor-Ready Brief & Body Map (Spans 2 cols) */}
            <div className="md:col-span-2">
              <TiltCard className="h-full rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <FileText className="h-6 w-6" />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-mono text-muted-foreground">
                    Clinical SOAP Export
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-semibold tracking-tight">
                  Physician-Ready Handoff Brief
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-xl">
                  Never repeat your story from scratch. MediAI compiles your symptom timeline, flagged body-map coordinates, and vital readings into a clean clinical brief you can share directly with your doctor.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                    <span className="font-semibold text-foreground">Structured SOAP</span>
                    <p className="text-[11px] text-muted-foreground">Subjective, Objective, Assessment, Plan formatted.</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                    <span className="font-semibold text-foreground">Interactive Body Map</span>
                    <p className="text-[11px] text-muted-foreground">Pinpoint pain location, radiation, and onset.</p>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                    <span className="font-semibold text-foreground">One-Click Share</span>
                    <p className="text-[11px] text-muted-foreground">Export as verified PDF or encrypted link.</p>
                  </div>
                </div>
              </TiltCard>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 4. Unified Interactive Clinical Console ---------------- */}
      <section id="console" className="scroll-mt-20 py-20 lg:py-28">
        <div className="container-page space-y-10">
          <Reveal className="max-w-2xl">
            <p className="eyebrow">Interactive Verification</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Watch it reason, verify, and simulate.
            </h2>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              Experience the core engines live: test the triage workflow, inspect the multi-agent consensus checks, or adjust biometric sliders to see real-time risk recalculations.
            </p>
          </Reveal>

          {/* Unified console demo */}
          <Reveal delay={0.08}>
            <InteractiveConsoleDemo />
          </Reveal>
        </div>
      </section>

      {/* ---------------- 5. Streamlined 3-Step Care Pathway ---------------- */}
      <section id="how" className="scroll-mt-20 py-20 lg:py-28 border-y border-border/40 bg-muted/20">
        <div className="container-page space-y-12">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Care Pathway</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              From symptom to solution in minutes.
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              No endless questionnaires or unverified medical searches.
            </p>
          </Reveal>

          <RevealGroup className="grid gap-6 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Describe Your Symptoms",
                desc: "Type or use voice in natural language. MediAI asks smart clarifying questions to isolate clinical indicators.",
                icon: Mic,
              },
              {
                step: "02",
                title: "Multi-Agent Consensus",
                desc: "Four specialized agents check differential databases, pharmacy interactions, and red flags before presenting results.",
                icon: BrainCircuit,
              },
              {
                step: "03",
                title: "Take Informed Action",
                desc: "Review your summary brief, track ongoing trends in your diary, or book directly with a verified clinic specialist.",
                icon: CalendarCheck,
              },
            ].map((item) => (
              <RevealItem key={item.step}>
                <div className="relative h-full rounded-2xl border border-border/70 bg-card p-6 sm:p-7 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-extrabold text-primary/40">
                      {item.step}
                    </span>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <item.icon className="h-5 w-5" />
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.desc}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ---------------- 6. Fast Access & Auth Section ---------------- */}
      <section id="get-started" className="relative scroll-mt-20 py-20 lg:py-28">
        <div className="container-page">
          <Reveal className="mx-auto max-w-md">
            <div className="mb-8 text-center space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">
                {currentUser ? "Welcome Back to MediAI" : "Launch Your Consultation"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {currentUser
                  ? "Your session is authenticated. Seamlessly access your medical dashboard."
                  : "Private and secure triage. Your medical history stays strictly under your control."}
              </p>
            </div>

            <div className="rounded-2xl border border-border/80 bg-card/80 p-6 sm:p-8 shadow-xl backdrop-blur-md">
              {!isLoading && currentUser ? (
                <div className="space-y-3">
                  <Button
                    size="lg"
                    className="w-full rounded-xl font-medium"
                    onClick={() => setLocation("/dashboard")}
                  >
                    Open Medical Dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link href="/appointments">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full rounded-xl font-medium"
                    >
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      Book Clinic Consultation
                    </Button>
                  </Link>
                </div>
              ) : (
                <Tabs value={authMode} onValueChange={setAuthMode}>
                  <TabsList className="mb-6 grid w-full grid-cols-2 rounded-xl">
                    <TabsTrigger value="login" className="rounded-lg text-xs font-semibold">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="signup" className="rounded-lg text-xs font-semibold">
                      Create Account
                    </TabsTrigger>
                  </TabsList>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={authMode}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.2 }}
                    >
                      <TabsContent value="login" className="mt-0">
                        <LoginForm onSuccess={handleLoginSuccess} />
                      </TabsContent>
                      <TabsContent value="signup" className="mt-0">
                        <SignUpForm onSuccess={handleLoginSuccess} />
                      </TabsContent>
                    </motion.div>
                  </AnimatePresence>
                </Tabs>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------- 7. Clean Refined Footer ---------------- */}
      <footer className="border-t border-border/60 bg-muted/30">
        <div className="container-page py-12 space-y-8">
          {/* Medical disclaimer alert banner */}
          <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-4 text-xs text-muted-foreground shadow-xs">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-foreground">Clinical Notice:</strong> MediAI is an intelligent triage and decision-support instrument incorporating RxNorm validation, multi-agent consilium verification, and calibrated organ risk models. It is designed to assist and inform, never to replace professional emergency medical diagnosis. In life-threatening emergencies, dial your local emergency services immediately.
            </p>
          </div>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                setLocation("/");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-90 text-left"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-tr from-emerald-600 to-cyan-500 text-white">
                <Stethoscope className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-bold tracking-tight">MediAI</span>
            </button>

            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} MediAI Healthcare Systems. All clinical data encrypted.
            </p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <button
                onClick={() => scrollToSection("capabilities")}
                className="transition-colors hover:text-foreground"
              >
                Capabilities
              </button>
              <button
                onClick={() => scrollToSection("console")}
                className="transition-colors hover:text-foreground"
              >
                Console
              </button>
              <button
                onClick={() => scrollToSection("how")}
                className="transition-colors hover:text-foreground"
              >
                Pathway
              </button>
              <Link href="/dashboard" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
