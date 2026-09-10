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
  CalendarCheck,
  ClipboardList,
  FileImage,
  Info,
  LineChart,
  Lock,
  MessageSquareText,
  Mic,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Reveal, RevealGroup, RevealItem, ScrollProgress } from "@/components/ui/reveal";
import { LoginForm, SignUpForm } from "@/components/AuthForms";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/use-auth";
import { fadeUp, scaleIn, slideIn, transition } from "@/lib/motion";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

/**
 * `span` drives an intentionally uneven grid. A row of three identical
 * feature cards is the most recognisable generated-layout signature, so the
 * rows alternate 4/2, 2/4, 3/3 instead.
 */
const features = [
  {
    icon: MessageSquareText,
    title: "Structured triage",
    body: "Describe how you feel in your own words. You get back what it could mean, what to do now, and the signs that mean you should not wait.",
    span: "md:col-span-4",
  },
  {
    icon: LineChart,
    title: "Explained risk scores",
    body: "Diabetes, heart, liver and kidney assessments return a percentage next to the inputs that moved it, so the number is never a black box.",
    span: "md:col-span-2",
  },
  {
    icon: Mic,
    title: "Voice when typing is hard",
    body: "Speak your symptoms instead of typing them. Useful when you are unwell, and when English is not the language you think in.",
    span: "md:col-span-2",
  },
  {
    icon: FileImage,
    title: "Reports and images",
    body: "Upload a lab report or a photo of an affected area and get a plain-language reading of what the values and visible features suggest.",
    span: "md:col-span-4",
  },
  {
    icon: ClipboardList,
    title: "A diary that spots trends",
    body: "Log symptoms over days and weeks. Patterns across time are what a single consultation cannot see.",
    span: "md:col-span-3",
  },
  {
    icon: CalendarCheck,
    title: "Straight through to a doctor",
    body: "When the conversation suggests you should be seen, book a real appointment without starting again somewhere else.",
    span: "md:col-span-3",
  },
];

const steps = [
  {
    title: "Tell it what is wrong",
    body: "Type or speak. Follow-up questions narrow things down the way an intake conversation would.",
  },
  {
    title: "See the reasoning",
    body: "Guidance arrives structured: what it could mean, what to do, and when to seek urgent care.",
  },
  {
    title: "Act on it",
    body: "Track it in the diary, run a risk assessment, or book a consultation. Your history stays in one place.",
  },
];

/* ------------------------------------------------------------------ */
/* Hero product preview                                                */
/* ------------------------------------------------------------------ */

function ChatPreview() {
  return (
    <div className="surface-raised overflow-hidden rounded-2xl">
      <div className="border-b border-border bg-muted/40 px-5 py-3">
        <p className="text-xs font-medium text-muted-foreground">
          An actual reply, in the format the assistant always answers in
        </p>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {/* Patient message */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition.slow, delay: 0.25 }}
          className="flex justify-end"
        >
          <p className="max-w-[78%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            I&apos;ve had a fever and a sore throat since yesterday
          </p>
        </motion.div>

        {/* Assistant reply */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition.slow, delay: 0.45 }}
          className="flex justify-start"
        >
          <div className="max-w-[88%] space-y-3 rounded-2xl rounded-bl-md border border-border bg-muted/40 px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What this could mean
              </p>
              <p className="mt-1 text-sm text-foreground/90">
                Most likely a <span className="font-semibold">viral upper respiratory infection</span>.
                Two questions to narrow it down:
              </p>
            </div>
            <ul className="space-y-1.5 text-sm text-foreground/80">
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                Is the pain worse on one side when you swallow?
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                Any rash, or trouble breathing?
              </li>
            </ul>
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              <p className="text-xs text-foreground/80">
                Seek care today if your temperature stays above 39&nbsp;°C or you
                cannot keep fluids down.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Suggested action */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition.slow, delay: 0.65 }}
          className="flex justify-start pl-1"
        >
          <span className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary">
            <CalendarCheck className="h-3.5 w-3.5" />
            Book consultation
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Risk card, used in the deep-dive row                                */
/* ------------------------------------------------------------------ */

const riskFactors = [
  { label: "Fasting glucose", value: "142 mg/dL", weight: 82 },
  { label: "BMI", value: "31.4", weight: 54 },
  { label: "Family history", value: "Present", weight: 38 },
  { label: "Age", value: "46", weight: 21 },
];

function RiskBar({
  percent,
  delay,
  size,
}: {
  percent: number;
  delay: number;
  size: "lg" | "sm";
}) {
  const reduceMotion = useReducedMotion();
  const scale = Math.max(0, Math.min(percent, 100)) / 100;

  return (
    <div
      className={`overflow-hidden rounded-full bg-muted ${
        size === "lg" ? "h-1.5" : "h-1"
      }`}
    >
      <motion.div
        initial={reduceMotion ? false : { scaleX: 0 }}
        animate={{ scaleX: scale }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }
        }
        className={`h-full origin-left rounded-full ${
          size === "lg" ? "bg-primary" : "bg-primary/45"
        }`}
      />
    </div>
  );
}

function RiskPreview() {
  return (
    <div className="surface-raised rounded-2xl p-5 sm:p-6">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Diabetes risk</p>
        <p className="text-xs text-muted-foreground">Moderate</p>
      </div>

      <div className="mt-3 flex items-end gap-3">
        <span className="text-4xl font-semibold tracking-tight" data-numeric>
          38<span className="text-2xl text-muted-foreground">%</span>
        </span>
      </div>

      <div className="mt-3">
        <RiskBar percent={38} delay={0.15} size="lg" />
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        What moved the number
      </p>

      <ul className="mt-2.5 space-y-2.5">
        {riskFactors.map((f, i) => (
          <li key={f.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-foreground/85">{f.label}</span>
              <span className="text-xs text-muted-foreground" data-numeric>
                {f.value}
              </span>
            </div>
            <RiskBar percent={f.weight} delay={0.25 + i * 0.08} size="sm" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  const { currentUser, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState("login");
  const [navSolid, setNavSolid] = useState(false);

  // useScroll reads scroll outside the React render cycle. A raw scroll
  // listener would set state on every frame and re-render the whole page.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setNavSolid(y > 16));

  const handleLoginSuccess = () => setLocation("/dashboard");

  const goToAuth = () =>
    document
      .getElementById("get-started")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-screen bg-background">
      <ScrollProgress />

      {/* ---------------- Nav ---------------- */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-base ${
          navSolid
            ? "border-b border-border bg-background/85 backdrop-blur-md"
            : "border-b border-transparent"
        }`}
      >
        <nav className="container-page flex h-16 items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">MediAI</span>
          </a>

          <div className="hidden items-center gap-1 md:flex">
            {[
              ["Features", "#features"],
              ["How it works", "#how"],
              ["Risk scores", "#risk"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {currentUser ? (
              <Button size="sm" onClick={() => setLocation("/dashboard")}>
                Dashboard
              </Button>
            ) : (
              <Button size="sm" onClick={goToAuth}>
                Get started
              </Button>
            )}
          </div>
        </nav>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section id="top" className="relative overflow-hidden pt-16">
        {/* One soft, static wash. A hairline grid overlay here would only be
            decoration, and a looping drift animation communicates nothing. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 left-1/2 h-[460px] w-[760px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <div className="container-page relative grid gap-14 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={transition.slow}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs"
            >
              <Stethoscope className="h-3.5 w-3.5 text-primary" />
              Guidance in minutes, not appointments
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition.slow, delay: 0.05 }}
              className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl"
            >
              Understand your symptoms{" "}
              <span className="text-primary">before</span> you sit in a waiting
              room.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition.slow, delay: 0.1 }}
              className="mt-5 max-w-xl text-lg text-muted-foreground"
            >
              MediAI turns a description of how you feel into structured
              guidance: what it could mean, what to do now, and the specific
              signs that mean you should be seen today. Then it books the
              appointment.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...transition.slow, delay: 0.15 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              {currentUser ? (
                <>
                  <Button size="lg" onClick={() => setLocation("/dashboard")}>
                    Open dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link href="/appointments">
                    <Button size="lg" variant="outline">
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      Book consultation
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button size="lg" onClick={goToAuth}>
                    Start a consultation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <a href="#how">See how it works</a>
                  </Button>
                </>
              )}
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...transition.slow, delay: 0.22 }}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
            >
              <li className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Your records stay yours
              </li>
              <li className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-primary" />
                Four risk models
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Escalates, never diagnoses
              </li>
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition.slow, delay: 0.12 }}
            className="lg:pl-4"
          >
            <ChatPreview />
          </motion.div>
        </div>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="container-page py-20 lg:py-28">
        <Reveal className="max-w-2xl">
          <p className="eyebrow">What it does</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Six things, each of which finishes the job.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Every feature ends somewhere useful: a decision, a logged data
            point, or a booked appointment. None of them stop at a wall of text.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid items-start gap-4 md:grid-cols-6">
          {features.map((f) => (
            <RevealItem key={f.title} className={f.span}>
              <article className="surface lift group p-6">
                <span className="grid h-10 w-10 place-items-center rounded-lg border border-primary/20 bg-primary/8 text-primary transition-colors duration-base group-hover:bg-primary/15">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section id="how" className="border-y border-border bg-muted/25">
        <div className="container-page py-20 lg:py-28">
          <Reveal className="mx-auto max-w-2xl">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps, about two minutes.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              No forms to fill in before you get anything back.
            </p>
          </Reveal>

          <RevealGroup className="mx-auto mt-10 max-w-2xl" stagger={0.09}>
            {steps.map((s, i) => (
              <RevealItem key={s.title}>
                <div
                  className={
                    i === 0 ? "pb-7" : "border-t border-border py-7 last:pb-0"
                  }
                >
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      {/* ---------------- Risk deep dive ---------------- */}
      <section id="risk" className="container-page py-20 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <Reveal variants={slideIn("left")}>
            <p className="eyebrow">Risk assessment</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              A percentage is useless without the reason behind it.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every risk assessment returns the inputs that actually moved the
              score, ranked by how much they contributed, with a plain-language
              note on each one.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Diabetes, heart, liver and kidney assessments",
                "Contributing factors ranked by weight",
                "Plain-language explanation for every factor",
                "Results saved to your history for comparison",
              ].map((item) => (
                <li key={item} className="flex gap-3 text-sm">
                  <span className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/12">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </span>
                  <span className="text-foreground/85">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal variants={scaleIn} className="lg:pl-6">
            <RiskPreview />
          </Reveal>
        </div>
      </section>

      {/* ---------------- Auth ---------------- */}
      <section
        id="get-started"
        className="relative overflow-hidden border-t border-border bg-muted/25"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/5 to-transparent"
        />
        <div className="container-page relative py-20 lg:py-28">
          <Reveal className="mx-auto max-w-md">
            <div className="mb-8 text-center">
              <h2 className="text-3xl font-semibold tracking-tight">
                {currentUser ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-3 text-muted-foreground">
                {currentUser
                  ? "Your session is active. Pick up where you left off."
                  : "Free to start. Your consultation history stays private to you."}
              </p>
            </div>

            <div className="surface-raised p-6 sm:p-8">
              {!isLoading && currentUser ? (
                <div className="space-y-3">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => setLocation("/dashboard")}
                  >
                    Open dashboard
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Link href="/appointments">
                    <Button size="lg" variant="outline" className="w-full">
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      Book consultation
                    </Button>
                  </Link>
                </div>
              ) : (
                <Tabs value={authMode} onValueChange={setAuthMode}>
                  <TabsList className="mb-6 grid w-full grid-cols-2">
                    <TabsTrigger value="login">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Create account</TabsTrigger>
                  </TabsList>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={authMode}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={transition.fast}
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

      {/* ---------------- Footer ---------------- */}
      <footer className="border-t border-border">
        <div className="container-page py-12">
          <Reveal
            variants={fadeUp}
            className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4"
          >
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                MediAI is not a diagnostic device.
              </span>{" "}
              It provides health information and triage guidance to help you
              decide whether and how urgently to seek care. It does not replace
              examination by a qualified clinician. In an emergency, contact your
              local emergency number immediately.
            </p>
          </Reveal>

          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Stethoscope className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold">MediAI</span>
            </div>

            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} MediAI. Built as a final-year project.
            </p>

            <div className="flex gap-5 text-sm text-muted-foreground">
              <a href="#features" className="transition-colors duration-fast hover:text-foreground">
                Features
              </a>
              <a href="#how" className="transition-colors duration-fast hover:text-foreground">
                How it works
              </a>
              <a href="#get-started" className="transition-colors duration-fast hover:text-foreground">
                Get started
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
