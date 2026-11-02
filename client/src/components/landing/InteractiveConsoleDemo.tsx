import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Pill,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";

export function InteractiveConsoleDemo() {
  const [activeTab, setActiveTab] = useState<"triage" | "consilium" | "risk">("triage");

  // State for interactive risk simulator tab
  const [glucose, setGlucose] = useState(132);
  const [bmi, setBmi] = useState(29.8);
  const [systolic, setSystolic] = useState(138);

  // Compute live projected diabetes & cardiometabolic risk
  const calculatedRisk = Math.min(
    95,
    Math.max(
      8,
      Math.round(
        (glucose - 80) * 0.45 + (bmi - 20) * 1.4 + (systolic - 100) * 0.3
      )
    )
  );

  const riskLevel =
    calculatedRisk < 25
      ? { label: "Low Risk", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" }
      : calculatedRisk < 55
      ? { label: "Moderate Risk", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30" }
      : { label: "Elevated Risk", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/30" };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-2xl backdrop-blur-xl">
      {/* Top console header bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
          </div>
          <span className="ml-2 font-mono text-xs font-medium text-muted-foreground">
            mediai-clinical-engine v2.8 // interactive-preview
          </span>
        </div>

        {/* Console Mode Switcher Tabs */}
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-background/50 p-1">
          <button
            onClick={() => setActiveTab("triage")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
              activeTab === "triage"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Differential</span> Triage
          </button>
          <button
            onClick={() => setActiveTab("consilium")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
              activeTab === "consilium"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Multi-Agent</span> Consilium
          </button>
          <button
            onClick={() => setActiveTab("risk")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
              activeTab === "risk"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            Risk Simulator
          </button>
        </div>
      </div>

      {/* Main Console Content */}
      <div className="p-5 sm:p-7 min-h-[360px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {/* TAB 1: DIFFERENTIAL TRIAGE */}
          {activeTab === "triage" && (
            <motion.div
              key="triage"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid gap-6 md:grid-cols-2"
            >
              {/* Intake chat card */}
              <div className="space-y-3.5 rounded-xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                    Patient Intake Analysis
                  </span>
                  <span className="font-mono">SNOMED CT Mapped</span>
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-foreground/90">
                  <span className="font-semibold text-primary">Patient:</span> "Sudden sharp lower-right abdominal pain since this morning, accompanied by mild nausea."
                </div>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                    <BrainCircuit className="h-3.5 w-3.5" />
                    Targeted Clarifying Question
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    "Does the discomfort worsen when pressure is released (rebound tenderness), or when coughing?"
                  </p>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  <span>3 independent clinical citations matched</span>
                </div>
              </div>

              {/* Differential ranking panel */}
              <div className="space-y-3.5 rounded-xl border border-border/70 bg-background/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Differential Probability Ranking
                </p>

                <div className="space-y-2.5">
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>Acute Appendicitis</span>
                      <span className="text-emerald-500 font-mono">68% Match</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500 w-[68%]" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>Mesenteric Adenitis</span>
                      <span className="text-muted-foreground font-mono">21% Match</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/50 w-[21%]" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span>Gastroenteritis (Atypical)</span>
                      <span className="text-muted-foreground font-mono">11% Match</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/30 w-[11%]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Escalation Rule Triggered: Urgent in-person evaluation advised within 4 hours.</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: MULTI-AGENT CONSILIUM */}
          {activeTab === "consilium" && (
            <motion.div
              key="consilium"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Consilium Multi-Agent Convergence Check
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Four autonomous clinical agents analyze case evidence independently to eliminate bias and blindspots.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Consensus Verified
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* Agent 1: Clinical Generalist */}
                <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-primary" />
                      Agent 01: Generalist
                    </span>
                    <span className="text-[10px] font-mono text-emerald-500">Agreed</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Identified classic migration pattern from periumbilical to right lower quadrant.
                  </p>
                </div>

                {/* Agent 2: Pharmacologist */}
                <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Pill className="h-3.5 w-3.5 text-cyan-500" />
                      Agent 02: Rx Safety
                    </span>
                    <span className="text-[10px] font-mono text-emerald-500">No Conflict</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    RxNorm check cleared: No NSAID interference masking acute inflammation signals.
                  </p>
                </div>

                {/* Agent 3: Red-Team Skeptic */}
                <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-amber-500" />
                      Agent 03: Skeptic
                    </span>
                    <span className="text-[10px] font-mono text-amber-500">Challenged</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tested against renal colic & ovarian cyst torsion; ruling out based on fever absence.
                  </p>
                </div>

                {/* Agent 4: Clinical Lead */}
                <div className="rounded-xl border border-border/70 bg-background/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                      Agent 04: Synthesis
                    </span>
                    <span className="text-[10px] font-mono text-emerald-500">Finalized</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Weighted synthesis generates structured physician handoff brief for the surgeon.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: RISK SIMULATOR */}
          {activeTab === "risk" && (
            <motion.div
              key="risk"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="grid gap-6 md:grid-cols-2"
            >
              {/* Sliders */}
              <div className="space-y-4 rounded-xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Biometric Biomarkers
                  </span>
                  <span className="text-xs text-primary font-mono">Live Recalculation</span>
                </div>

                {/* Glucose */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">Fasting Blood Glucose</span>
                    <span className="font-mono font-semibold text-primary">{glucose} mg/dL</span>
                  </div>
                  <Slider
                    value={[glucose]}
                    min={70}
                    max={200}
                    step={1}
                    onValueChange={(vals) => setGlucose(vals[0])}
                    className="cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Normal (80-100)</span>
                    <span>Pre-diabetic (100-125)</span>
                    <span>Elevated (&gt;126)</span>
                  </div>
                </div>

                {/* BMI */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">Body Mass Index (BMI)</span>
                    <span className="font-mono font-semibold text-primary">{bmi.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[bmi]}
                    min={18}
                    max={42}
                    step={0.5}
                    onValueChange={(vals) => setBmi(vals[0])}
                    className="cursor-pointer"
                  />
                </div>

                {/* Blood Pressure */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">Systolic Blood Pressure</span>
                    <span className="font-mono font-semibold text-primary">{systolic} mmHg</span>
                  </div>
                  <Slider
                    value={[systolic]}
                    min={90}
                    max={180}
                    step={1}
                    onValueChange={(vals) => setSystolic(vals[0])}
                    className="cursor-pointer"
                  />
                </div>
              </div>

              {/* Dynamic Score Output */}
              <div className="flex flex-col justify-between rounded-xl border border-border/70 bg-background/60 p-5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">5-Year Cardiometabolic Risk</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskLevel.bg} ${riskLevel.color} border ${riskLevel.border}`}>
                      {riskLevel.label}
                    </span>
                  </div>

                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-5xl font-extrabold tracking-tight font-mono text-foreground">
                      {calculatedRisk}
                    </span>
                    <span className="text-2xl text-muted-foreground font-mono">%</span>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={`h-full ${
                        calculatedRisk < 35
                          ? "bg-emerald-500"
                          : calculatedRisk < 60
                          ? "bg-amber-500"
                          : "bg-rose-500"
                      }`}
                      animate={{ width: `${calculatedRisk}%` }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    />
                  </div>
                </div>

                <div className="mt-4 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    AI Actionable Recommendation:
                  </div>
                  <p>
                    {glucose > 125
                      ? "A 15% reduction in fasting glucose via diet or metformin drops your composite risk by ~18%."
                      : "Maintaining current glucose within normal limits prevents long-term vascular complications."}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer status strip */}
      <div className="flex flex-wrap items-center justify-between border-t border-border/50 bg-muted/20 px-4 py-2.5 text-[11px] text-muted-foreground sm:px-6">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          HIPAA & GDPR Compliant Encrypted Telemetry
        </span>
        <span className="hidden sm:inline font-mono">
          Consilium Consensus Model v2.8 · Instant Execution
        </span>
      </div>
    </div>
  );
}
