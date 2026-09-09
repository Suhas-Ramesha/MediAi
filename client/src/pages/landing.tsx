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
  CalendarCheck,
  FileImage,
  Info,
  LineChart,
  Lock,
  Mic,
  ShieldCheck,
} from "lucide-react";

import { BrandMark } from "@/components/BrandMark";
import { LoginForm, SignUpForm } from "@/components/AuthForms";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { transition } from "@/lib/motion";

const features = [
  {
    n: "01",
    title: "Structured triage",
    body: "Describe how you feel in your own words. You get back what it could mean, what to do now, and the signs that mean you should not wait.",
  },
  {
    n: "02",
    title: "Explained risk scores",
    body: "Diabetes, heart, liver and kidney assessments return a percentage next to the inputs that moved it.",
  },
  {
    n: "03",
    title: "Voice when typing is hard",
    body: "Speak your symptoms instead of typing them. The transcript is still yours to edit.",
  },
  {
    n: "04",
    title: "Reports and images",
    body: "Upload a lab report or a photo of an affected area and get a plain-language reading of the values and visible features.",
  },
  {
    n: "05",
    title: "A diary that spots trends",
    body: "Log symptoms over days and weeks. Patterns across time are what a single consultation cannot see.",
  },
  {
    n: "06",
    title: "Straight through to a doctor",
    body: "When the conversation suggests you should be seen, book a real appointment without starting again somewhere else.",
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

const riskFactors = [
  { label: "Fasting glucose", value: "142 mg/dL", weight: 82 },
  { label: "BMI", value: "31.4", weight: 54 },
  { label: "Family history", value: "Present", weight: 38 },
  { label: "Age", value: "46", weight: 21 },
];

function ConsultSheet() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10, filter: "blur(6px)" },
          animate: { opacity: 1, y: 0, filter: "blur(0px)" },
          transition: { ...transition.slow, delay },
        };

  return (
    <div className="surface-raised overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-sm text-muted-foreground">Live consult format</p>
        <span className="text-xs text-muted-foreground">2 min · not a diagnosis</span>
      </div>
      <div className="chart-sheet space-y-4 p-5 sm:p-6">
        <motion.div {...enter(0.15)} className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            I&apos;ve had a fever and a sore throat since yesterday
          </p>
        </motion.div>

        <motion.div {...enter(0.55)} className="max-w-[92%] space-y-3 rounded-2xl rounded-bl-sm border border-border bg-card/90 px-4 py-3.5">
          <div>
            <p className="font-display text-base italic text-primary">What this could mean</p>
            <p className="mt-1 text-sm leading-relaxed">
              Most likely a <strong className="font-semibold">viral upper respiratory infection</strong>.
              Two questions to narrow it down:
            </p>
          </div>
          <ul className="space-y-1.5 text-sm text-foreground/85">
            <li>Is the pain worse on one side when you swallow?</li>
            <li>Any rash, or trouble breathing?</li>
          </ul>
          <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2">
            <p className="text-sm text-foreground/85">
              Seek care today if your temperature stays above 39 °C or you cannot keep fluids down.
            </p>
          </div>
        </motion.div>

        <motion.div {...enter(0.95)} className="flex">
          <span className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            <CalendarCheck className="h-3.5 w-3.5" />
            Book consultation
          </span>
        </motion.div>
      </div>
    </div>
  );
}

function RiskPreview() {
  const reduce = useReducedMotion();
  return (
    <div className="surface-raised p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-2xl">Diabetes risk</p>
        <p className="text-sm text-muted-foreground">Moderate</p>
      </div>
      <p className="mt-4 text-5xl font-medium tracking-tight" data-numeric>
        38
        <span className="text-2xl text-muted-foreground">%</span>
      </p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <motion.div
          initial={reduce ? { scaleX: 0.38 } : { scaleX: 0 }}
          whileInView={{ scaleX: 0.38 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="h-full origin-left rounded-full bg-primary"
        />
      </div>
      <p className="mt-6 font-display text-lg italic text-primary">What moved the number</p>
      <ul className="mt-3 space-y-3">
        {riskFactors.map((f, i) => (
          <li key={f.label} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span>{f.label}</span>
              <span className="text-muted-foreground" data-numeric>
                {f.value}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={reduce ? { scaleX: f.weight / 100 } : { scaleX: 0 }}
                whileInView={{ scaleX: f.weight / 100 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.55,
                  ease: [0.16, 1, 0.3, 1],
                  delay: reduce ? 0 : 0.12 + i * 0.06,
                }}
                className="h-full origin-left rounded-full bg-primary/50"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Landing() {
  const { currentUser, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [authMode, setAuthMode] = useState("login");
  const [navSolid, setNavSolid] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setNavSolid(y > 16));

  const handleLoginSuccess = () => setLocation("/dashboard");
  const goToAuth = () =>
    document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="min-h-[100dvh]">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-base ${
          navSolid ? "border-b border-border bg-background/80 backdrop-blur-md" : ""
        }`}
      >
        <nav className="container-page flex h-16 items-center justify-between">
          <a href="#top" className="text-foreground">
            <BrandMark />
          </a>
          <div className="hidden items-center gap-1 md:flex">
            {[
              ["What it does", "#features"],
              ["How it works", "#how"],
              ["Risk scores", "#risk"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {currentUser ? (
              <Button size="sm" onClick={() => setLocation("/dashboard")}>
                Open dashboard
              </Button>
            ) : (
              <Button size="sm" onClick={goToAuth}>
                Start a consultation
              </Button>
            )}
          </div>
        </nav>
      </header>

      <section id="top" className="pt-16">
        <div className="container-page grid gap-12 pb-20 pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:pb-28 lg:pt-24">
          <div>
            <p className="kicker">Guidance in minutes, not waiting rooms</p>
            <h1 className="mt-4 max-w-[18ch] font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.4rem] lg:leading-[1.08]">
              Understand your symptoms before you sit down.
            </h1>
            <p className="mt-5 max-w-[42ch] text-lg text-muted-foreground">
              MediAI turns a description of how you feel into structured guidance:
              what it could mean, what to do now, and the specific signs that mean
              you should be seen today. Then it books the appointment.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {currentUser ? (
                <>
                  <Button size="lg" onClick={() => setLocation("/dashboard")}>
                    Open dashboard
                  </Button>
                  <Link href="/appointments">
                    <Button size="lg" variant="outline">
                      Book consultation
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Button size="lg" onClick={goToAuth}>
                    Start a consultation
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <a href="#how">See how it works</a>
                  </Button>
                </>
              )}
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-primary" />
                Your records stay yours
              </li>
              <li className="flex items-center gap-2">
                <LineChart className="h-3.5 w-3.5 text-primary" />
                Four risk models
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Escalates, never diagnoses
              </li>
            </ul>
          </div>
          <ConsultSheet />
        </div>
      </section>

      <section id="features" className="border-y border-border bg-card/40">
        <div className="container-page py-20 lg:py-28">
          <div className="max-w-xl">
            <p className="kicker">What it does</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Six things, each of which finishes the job.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every feature ends somewhere useful: a decision, a logged data
              point, or a booked appointment.
            </p>
          </div>
          <ol className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f.n} className="grid grid-cols-[3rem_1fr] gap-4">
                <span className="font-display text-2xl text-primary/70" data-numeric>
                  {f.n}
                </span>
                <div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="how">
        <div className="container-page grid gap-12 py-20 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-20 lg:py-28">
          <div>
            <p className="kicker">How it works</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps, about two minutes.
            </h2>
            <p className="mt-4 text-muted-foreground">
              No forms to fill in before you get anything back.
            </p>
          </div>
          <ol>
            {steps.map((s, i) => (
              <li
                key={s.title}
                className={i === 0 ? "pb-8" : "border-t border-border py-8 last:pb-0"}
              >
                <h3 className="font-display text-2xl">{s.title}</h3>
                <p className="mt-2 max-w-xl leading-relaxed text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="risk" className="border-y border-border bg-card/40">
        <div className="container-page grid gap-12 py-20 lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-28">
          <div>
            <p className="kicker">Risk assessment</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              A percentage is useless without the reason behind it.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Every risk assessment returns the inputs that actually moved the
              score, ranked by how much they contributed.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              <li className="flex gap-3">
                <Mic className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Diabetes, heart, liver and kidney assessments
              </li>
              <li className="flex gap-3">
                <LineChart className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Contributing factors ranked by weight
              </li>
              <li className="flex gap-3">
                <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Results saved to your history for comparison
              </li>
            </ul>
          </div>
          <RiskPreview />
        </div>
      </section>

      <section id="get-started">
        <div className="container-page py-20 lg:py-28">
          <div className="mx-auto max-w-md">
            <div className="mb-8">
              <h2 className="font-display text-3xl font-semibold tracking-tight">
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
                  <Button size="lg" className="w-full" onClick={() => setLocation("/dashboard")}>
                    Open dashboard
                  </Button>
                  <Link href="/appointments">
                    <Button size="lg" variant="outline" className="w-full">
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
                      exit={{ opacity: 0, y: -4 }}
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
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container-page py-12">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">MediAI is not a diagnostic device.</span>{" "}
              It provides health information and triage guidance to help you decide
              whether and how urgently to seek care. It does not replace examination
              by a qualified clinician. In an emergency, contact your local emergency
              number immediately.
            </p>
          </div>
          <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <BrandMark />
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} MediAI. Built as a final-year project.
            </p>
            <div className="flex gap-5 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground">
                What it does
              </a>
              <a href="#how" className="hover:text-foreground">
                How it works
              </a>
              <a href="#get-started" className="hover:text-foreground">
                Start
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
