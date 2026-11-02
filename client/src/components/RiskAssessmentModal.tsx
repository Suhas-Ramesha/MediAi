import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import type { RiskDisease } from "@/lib/riskApi";

export interface RiskAssessmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disease: RiskDisease | null;
  onSubmit: (payload: Record<string, number | string>) => void;
  isSubmitting?: boolean;
}

const DEFAULT_DIABETES = {
  pregnancies: 0,
  glucose: 85,
  bp: 70,
  skin: 20,
  insulin: 12,
  bmi: 22.5,
  pedigree: 0.18,
  age: 30,
};

const DEFAULT_HEART = {
  age: 35,
  cp: "No chest pain or tightness",
  trestbps: 118,
  chol: 180,
  fbs: "No (under 120 mg/dl)",
  restecg: "Normal",
  thalach: 165,
  exang: "No",
  oldpeak: 0.0,
  slope: "Upsloping",
  ca: "0",
  thal: "Normal",
};

const DEFAULT_LIVER = {
  Age: 35,
  Total_Bilirubin: 0.8,
  Direct_Bilirubin: 0.2,
  Alkaline_Phosphotase: 75,
  Alamine_Aminotransferase: 22,
  Aspartate_Aminotransferase: 24,
  Total_Protiens: 7.2,
  Albumin: 4.5,
  Albumin_and_Globulin_Ratio: 1.3,
};

const DEFAULT_KIDNEY = {
  creatinine: 0.9,
  urea: 35,
  hemoglobin: 15.0,
  bp: 75,
};

const CP_OPTIONS = [
  { value: "No chest pain or tightness", label: "No chest pain or tightness" },
  {
    value: "Tightness or pressure when I walk or climb stairs",
    label: "Tightness or pressure when I walk or climb stairs",
  },
  {
    value: "Odd chest discomfort, not like classic squeezing",
    label: "Odd chest discomfort — not like classic squeezing",
  },
  {
    value: "Ache that does not feel like heart pain",
    label: "An ache that does not feel like heart pain",
  },
  { value: "I'm not sure", label: "I'm not sure" },
] as const;

const FBS_OPTIONS = [
  { value: "No (under 120 mg/dl)", label: "Under 120 — or I was told it was fine" },
  { value: "Yes (over 120 mg/dl)", label: "120 or higher on a fasting test" },
  { value: "I don't have this number", label: "I don't have this number" },
] as const;

const RESTECG_OPTIONS = [
  { value: "Normal", label: "They said my heart tracing (ECG) was normal" },
  { value: "ST-T wave abnormality", label: "They said the ECG pattern was irregular" },
  {
    value: "Left ventricular hypertrophy",
    label: "They said the heart muscle looked thickened on the ECG",
  },
  { value: "I don't know", label: "I have not had an ECG, or I don't remember" },
] as const;

const SLOPE_OPTIONS = [
  { value: "Upsloping", label: "The line rose during the exercise test" },
  { value: "Flat", label: "The line stayed flat during the exercise test" },
  { value: "Downsloping", label: "The line fell during the exercise test" },
  { value: "I don't know", label: "I have not had an exercise heart test" },
] as const;

const THAL_OPTIONS = [
  { value: "Normal", label: "Nobody has told me I have this" },
  {
    value: "Reversible defect",
    label: "A scan showed a blood-flow problem that comes and goes",
  },
  { value: "Fixed defect", label: "A scan showed an old, fixed blood-flow scar" },
  { value: "I don't know", label: "I don't know / I have not had this scan" },
] as const;

const CA_OPTIONS = [
  { value: "0", label: "I have not had a dye test of the heart arteries" },
  { value: "1", label: "Doctor said 1 artery was narrowed" },
  { value: "2", label: "Doctor said 2 arteries were narrowed" },
  { value: "3", label: "Doctor said 3 arteries were narrowed" },
] as const;

function SliderField({
  label,
  hint,
  badge,
  badgeType = "neutral",
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  badge?: string;
  badgeType?: "higher-is-healthy" | "lower-is-healthy" | "neutral";
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const shown = Number.isInteger(step) && step >= 1 ? value : Number(value.toFixed(2));
  const badgeClasses =
    badgeType === "higher-is-healthy"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
      : badgeType === "lower-is-healthy"
        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25"
        : "bg-muted text-muted-foreground border-border/50";

  return (
    <div className="space-y-2 rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Label className="font-semibold text-foreground">{label}</Label>
          {badge ? (
            <span className={`inline-flex items-center text-[10.5px] font-medium px-2 py-0.5 rounded-full border ${badgeClasses}`}>
              {badge}
            </span>
          ) : null}
        </div>
        <span className="shrink-0 font-mono font-semibold text-foreground bg-muted/80 px-2 py-0.5 rounded text-xs self-start sm:self-auto">
          {shown}
        </span>
      </div>
      {hint ? <p className="text-xs font-normal text-muted-foreground leading-relaxed">{hint}</p> : null}
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

function Choice({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/50 bg-card/60 p-3 shadow-xs">
      <div>
        <Label className="font-semibold text-foreground">{label}</Label>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{hint}</p> : null}
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function RiskAssessmentModal({
  open,
  onOpenChange,
  disease,
  onSubmit,
  isSubmitting,
}: RiskAssessmentModalProps) {
  const [sex, setSex] = useState<"male" | "female">("male");
  const [diabetes, setDiabetes] = useState(DEFAULT_DIABETES);
  const [heart, setHeart] = useState(DEFAULT_HEART);
  const [liver, setLiver] = useState(DEFAULT_LIVER);
  const [kidney, setKidney] = useState(DEFAULT_KIDNEY);

  // Automatically start all slider values from normal reference values when opened
  useEffect(() => {
    if (open) {
      setDiabetes(DEFAULT_DIABETES);
      setHeart(DEFAULT_HEART);
      setLiver(DEFAULT_LIVER);
      setKidney(DEFAULT_KIDNEY);
      setSex("male");
    }
  }, [open, disease]);

  const title = useMemo(() => {
    switch (disease) {
      case "diabetes":
        return "Diabetes risk check";
      case "heart":
        return "Heart risk check";
      case "liver":
        return "Liver risk check";
      case "kidney":
        return "Kidney risk check";
      default:
        return "Risk check";
    }
  }, [disease]);

  const sexBlock = (id: string) => (
    <div className="space-y-2">
      <Label>What is your sex?</Label>
      <RadioGroup
        value={sex}
        onValueChange={(v) => {
          const next = v as "male" | "female";
          setSex(next);
          if (next === "male") setDiabetes((d) => ({ ...d, pregnancies: 0 }));
        }}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="female" id={`${id}-f`} />
          <Label htmlFor={`${id}-f`} className="font-normal">
            Female
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="male" id={`${id}-m`} />
          <Label htmlFor={`${id}-m`} className="font-normal">
            Male
          </Label>
        </div>
      </RadioGroup>
    </div>
  );

  const handleSubmit = () => {
    if (!disease) return;
    if (disease === "diabetes") {
      onSubmit({
        ...diabetes,
        pregnancies: sex === "male" ? 0 : diabetes.pregnancies,
      });
      return;
    }
    if (disease === "heart") {
      onSubmit({
        age: heart.age,
        sex: sex === "male" ? "Male" : "Female",
        cp: heart.cp,
        trestbps: heart.trestbps,
        chol: heart.chol,
        fbs: heart.fbs,
        restecg: heart.restecg,
        thalach: heart.thalach,
        exang: heart.exang,
        oldpeak: heart.oldpeak,
        slope: heart.slope,
        ca: Number(heart.ca),
        thal: heart.thal,
      });
      return;
    }
    if (disease === "liver") {
      onSubmit({
        ...liver,
        Gender: sex === "male" ? "Male" : "Female",
      });
      return;
    }
    onSubmit({
      creatinine: kidney.creatinine,
      urea: kidney.urea,
      hemoglobin: kidney.hemoglobin,
      bp: kidney.bp,
      bpScale: "diastolic",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Use numbers from a recent report if you have one. If you do not know a test result, pick
            “I don’t know” or leave the slider near the hint.
          </DialogDescription>
        </DialogHeader>

        {disease === "diabetes" && (
          <p className="rounded-md bg-muted/60 p-2 text-sm text-muted-foreground">
            Eight everyday numbers (same as the Pima / Pabna / NHANES model). Pregnancy is hidden
            for males.
          </p>
        )}
        {disease === "heart" && (
          <p className="rounded-md bg-muted/60 p-2 text-sm text-muted-foreground">
            Answer how it feels day to day. Hospital-only items can stay on “I don’t know”.
          </p>
        )}
        {disease === "liver" && (
          <p className="rounded-md bg-muted/60 p-2 text-sm text-muted-foreground">
            Copy these from a liver blood report. Higher albumin is usually healthier.
          </p>
        )}
        {disease === "kidney" && (
          <p className="rounded-md bg-muted/60 p-2 text-sm text-muted-foreground">
            This model only uses four numbers: creatinine, urea, hemoglobin, and the lower blood
            pressure reading. You do not need to know about heart-artery disease.
          </p>
        )}

        <div className="space-y-6 py-2">
          {disease === "diabetes" && (
            <div className="space-y-4">
              {sexBlock("dm")}
              {sex === "female" && (
                <SliderField
                  label="How many times have you been pregnant?"
                  hint="Count every pregnancy. Use 0 if none."
                  min={0}
                  max={17}
                  step={1}
                  value={diabetes.pregnancies}
                  onChange={(v) => setDiabetes((d) => ({ ...d, pregnancies: v }))}
                />
              )}
              <SliderField
                label="Fasting blood sugar (glucose)"
                hint="Blood sugar after an overnight fast (mg/dL). Normal fasting range on lab reports is 70–99."
                badge="Lower is healthier · Normal: 70–99"
                badgeType="lower-is-healthy"
                min={70}
                max={240}
                step={1}
                value={diabetes.glucose}
                onChange={(v) => setDiabetes((d) => ({ ...d, glucose: v }))}
              />
              <SliderField
                label="Blood pressure"
                hint="Resting diastolic cuff reading (mm Hg). Healthy range is 65–80."
                badge="Healthy: 65–80 mm Hg"
                badgeType="lower-is-healthy"
                min={65}
                max={110}
                step={1}
                value={diabetes.bp}
                onChange={(v) => setDiabetes((d) => ({ ...d, bp: v }))}
              />
              <SliderField
                label="Skin-fold thickness"
                hint="Triceps skin-fold measurement (mm). Leave near 20 if never measured."
                badge="Typical: 15–25 mm"
                badgeType="neutral"
                min={15}
                max={50}
                step={1}
                value={diabetes.skin}
                onChange={(v) => setDiabetes((d) => ({ ...d, skin: v }))}
              />
              <SliderField
                label="Insulin level"
                hint="Fasting serum insulin (μU/mL). Normal fasting range on lab reports is 5–25."
                badge="Lower is healthier · Normal: 5–25"
                badgeType="lower-is-healthy"
                min={5}
                max={150}
                step={1}
                value={diabetes.insulin}
                onChange={(v) => setDiabetes((d) => ({ ...d, insulin: v }))}
              />
              <SliderField
                label="Body mass index (BMI)"
                hint="Weight in kg ÷ height in metres squared. 18.5–24.9 is considered healthy weight."
                badge="Healthy: 18.5–24.9"
                badgeType="lower-is-healthy"
                min={18.5}
                max={42.0}
                step={0.5}
                value={diabetes.bmi}
                onChange={(v) => setDiabetes((d) => ({ ...d, bmi: v }))}
              />
              <SliderField
                label="Diabetes in your close family"
                hint="Diabetes pedigree score. Slide left if few or no biological relatives have diabetes."
                badge="Lower is healthier · Typical: 0.10–0.25"
                badgeType="lower-is-healthy"
                min={0.10}
                max={1.8}
                step={0.01}
                value={diabetes.pedigree}
                onChange={(v) => setDiabetes((d) => ({ ...d, pedigree: v }))}
              />
              <SliderField
                label="Your age"
                hint="In years."
                min={18}
                max={85}
                step={1}
                value={diabetes.age}
                onChange={(v) => setDiabetes((d) => ({ ...d, age: v }))}
              />
            </div>
          )}

          {disease === "heart" && (
            <div className="space-y-4">
              {sexBlock("ht")}
              <SliderField
                label="Your age"
                hint="In years."
                min={18}
                max={85}
                step={1}
                value={heart.age}
                onChange={(v) => setHeart((h) => ({ ...h, age: v }))}
              />
              <Choice
                label="When you get chest discomfort, what is it like?"
                hint="Pick the closest match, or 'No chest pain or tightness'."
                value={heart.cp}
                onChange={(v) => setHeart((h) => ({ ...h, cp: v }))}
                options={CP_OPTIONS}
              />
              <SliderField
                label="Blood pressure while resting"
                hint="Upper systolic reading from a cuff sitting quietly (mm Hg)."
                badge="Lower is healthier · Normal: < 120"
                badgeType="lower-is-healthy"
                min={100}
                max={190}
                step={1}
                value={heart.trestbps}
                onChange={(v) => setHeart((h) => ({ ...h, trestbps: v }))}
              />
              <SliderField
                label="Cholesterol in your blood"
                hint="Total serum cholesterol (mg/dL). Healthy is under 200."
                badge="Lower is healthier · Normal: < 200"
                badgeType="lower-is-healthy"
                min={140}
                max={350}
                step={1}
                value={heart.chol}
                onChange={(v) => setHeart((h) => ({ ...h, chol: v }))}
              />
              <Choice
                label="Fasting blood sugar"
                hint="A blood sugar test after not eating overnight."
                value={heart.fbs}
                onChange={(v) => setHeart((h) => ({ ...h, fbs: v }))}
                options={FBS_OPTIONS}
              />
              <Choice
                label="Heart tracing (ECG) while resting"
                value={heart.restecg}
                onChange={(v) => setHeart((h) => ({ ...h, restecg: v }))}
                options={RESTECG_OPTIONS}
              />
              <SliderField
                label="Highest heart rate you have reached"
                hint="Peak beats per minute during vigorous exertion."
                badge="Healthy: 140–190 bpm"
                badgeType="higher-is-healthy"
                min={120}
                max={205}
                step={1}
                value={heart.thalach}
                onChange={(v) => setHeart((h) => ({ ...h, thalach: v }))}
              />
              <Choice
                label="Does walking or exercise bring on chest pain?"
                value={heart.exang}
                onChange={(v) => setHeart((h) => ({ ...h, exang: v }))}
                options={[
                  { value: "No", label: "No" },
                  { value: "Yes", label: "Yes" },
                  { value: "I don't know", label: "I don't know / I rarely exercise" },
                ]}
              />
              <SliderField
                label="Exercise-test line dip (ST depression)"
                hint="ST depression during hospital stress test in mm. 0.0 means normal heart tracing without stress dip."
                badge="Lower is healthier · Normal: 0.0 mm"
                badgeType="lower-is-healthy"
                min={0.0}
                max={4.0}
                step={0.1}
                value={heart.oldpeak}
                onChange={(v) => setHeart((h) => ({ ...h, oldpeak: v }))}
              />
              <Choice
                label="Shape of the line on an exercise heart test"
                value={heart.slope}
                onChange={(v) => setHeart((h) => ({ ...h, slope: v }))}
                options={SLOPE_OPTIONS}
              />
              <Choice
                label="Have you had a dye test of the heart arteries?"
                hint="Number of major vessels (0–3) narrowed. 0 means clear vessels."
                value={heart.ca}
                onChange={(v) => setHeart((h) => ({ ...h, ca: v }))}
                options={CA_OPTIONS}
              />
              <Choice
                label="Special heart blood-flow scan (thal)"
                value={heart.thal}
                onChange={(v) => setHeart((h) => ({ ...h, thal: v }))}
                options={THAL_OPTIONS}
              />
            </div>
          )}

          {disease === "liver" && (
            <div className="space-y-4">
              {sexBlock("lv")}
              <SliderField
                label="Your age"
                hint="In years."
                min={18}
                max={85}
                step={1}
                value={liver.Age}
                onChange={(v) => setLiver((l) => ({ ...l, Age: v }))}
              />
              <SliderField
                label="Total bilirubin"
                hint="Yellow pigment from red blood cell breakdown (mg/dL). Normal reference is 0.2–1.2."
                badge="Lower is healthier · Normal: 0.2–1.2"
                badgeType="lower-is-healthy"
                min={0.2}
                max={10.0}
                step={0.1}
                value={liver.Total_Bilirubin}
                onChange={(v) => setLiver((l) => ({ ...l, Total_Bilirubin: v }))}
              />
              <SliderField
                label="Direct bilirubin"
                hint="Conjugated bilirubin fraction (mg/dL). Normal is under 0.3."
                badge="Normal: under 0.3"
                badgeType="lower-is-healthy"
                min={0.0}
                max={5.0}
                step={0.1}
                value={liver.Direct_Bilirubin}
                onChange={(v) => setLiver((l) => ({ ...l, Direct_Bilirubin: v }))}
              />
              <SliderField
                label="Alkaline phosphatase (ALP)"
                hint="Bile duct enzyme (U/L). Normal range on reports is 44–120."
                badge="Normal: 44–120 U/L"
                badgeType="lower-is-healthy"
                min={45}
                max={350}
                step={5}
                value={liver.Alkaline_Phosphotase}
                onChange={(v) => setLiver((l) => ({ ...l, Alkaline_Phosphotase: v }))}
              />
              <SliderField
                label="ALT (SGPT)"
                hint="Primary liver cell enzyme (U/L). Normal is 10–40. Rises with liver cell injury."
                badge="Lower is healthier · Normal: 10–40"
                badgeType="lower-is-healthy"
                min={10}
                max={250}
                step={1}
                value={liver.Alamine_Aminotransferase}
                onChange={(v) => setLiver((l) => ({ ...l, Alamine_Aminotransferase: v }))}
              />
              <SliderField
                label="AST (SGOT)"
                hint="Liver enzyme (U/L). Normal is 10–40. Rises with acute or chronic liver stress."
                badge="Lower is healthier · Normal: 10–40"
                badgeType="lower-is-healthy"
                min={10}
                max={250}
                step={1}
                value={liver.Aspartate_Aminotransferase}
                onChange={(v) => setLiver((l) => ({ ...l, Aspartate_Aminotransferase: v }))}
              />
              <SliderField
                label="Total protein"
                hint="Total protein in blood (g/dL). Normal reference range is 6.0–8.3."
                badge="Normal: 6.0–8.3 g/dL"
                badgeType="neutral"
                min={6.0}
                max={8.8}
                step={0.1}
                value={liver.Total_Protiens}
                onChange={(v) => setLiver((l) => ({ ...l, Total_Protiens: v }))}
              />
              <SliderField
                label="Albumin"
                hint="Vital protein synthesized exclusively by liver cells (g/dL). Crucial: unlike enzymes, LOWER albumin indicates liver failure; HIGHER is healthy."
                badge="Higher is healthier · Normal: 3.5–5.0"
                badgeType="higher-is-healthy"
                min={3.5}
                max={5.5}
                step={0.1}
                value={liver.Albumin}
                onChange={(v) => setLiver((l) => ({ ...l, Albumin: v }))}
              />
              <SliderField
                label="Albumin / globulin ratio (A/G)"
                hint="Ratio of albumin to globulin on your report. Normal is 1.0–2.2."
                badge="Normal: 1.0–2.2"
                badgeType="neutral"
                min={1.0}
                max={2.5}
                step={0.05}
                value={liver.Albumin_and_Globulin_Ratio}
                onChange={(v) => setLiver((l) => ({ ...l, Albumin_and_Globulin_Ratio: v }))}
              />
            </div>
          )}

          {disease === "kidney" && (
            <div className="space-y-4">
              <SliderField
                label="Creatinine"
                hint="Kidney waste in blood (mg/dL). Normal reference on lab reports is 0.7–1.2. Lower indicates effective filtration."
                badge="Lower is healthier · Normal: 0.7–1.2"
                badgeType="lower-is-healthy"
                min={0.7}
                max={8.0}
                step={0.1}
                value={kidney.creatinine}
                onChange={(v) => setKidney((k) => ({ ...k, creatinine: v }))}
              />
              <SliderField
                label="Urea (or BUN / blood urea)"
                hint="Protein waste filtered by kidneys (mg/dL). Normal range on reports is 15–45. Lower indicates healthy waste clearance."
                badge="Lower is healthier · Normal: 15–45"
                badgeType="lower-is-healthy"
                min={15}
                max={150}
                step={1}
                value={kidney.urea}
                onChange={(v) => setKidney((k) => ({ ...k, urea: v }))}
              />
              <SliderField
                label="Hemoglobin"
                hint="Oxygen-carrying protein in red blood cells (g/dL). Crucial: unlike waste products, LOWER hemoglobin indicates severe anemia or kidney distress; HIGHER is healthy."
                badge="Higher is healthier · Normal: 13.0–17.5"
                badgeType="higher-is-healthy"
                min={13.0}
                max={18.0}
                step={0.1}
                value={kidney.hemoglobin}
                onChange={(v) => setKidney((k) => ({ ...k, hemoglobin: v }))}
              />
              <SliderField
                label="Lower blood-pressure number (diastolic)"
                hint="Resting diastolic cuff reading (e.g. 75 in 118/75 mm Hg). Normal is 65–80."
                badge="Healthy: 65–80 mm Hg"
                badgeType="lower-is-healthy"
                min={65}
                max={120}
                step={1}
                value={kidney.bp}
                onChange={(v) => setKidney((k) => ({ ...k, bp: v }))}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground self-start sm:self-auto px-2"
            onClick={() => {
              setDiabetes(DEFAULT_DIABETES);
              setHeart(DEFAULT_HEART);
              setLiver(DEFAULT_LIVER);
              setKidney(DEFAULT_KIDNEY);
              setSex("male");
            }}
          >
            Reset to normal values
          </Button>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!disease || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Estimating…
                </>
              ) : (
                "See my estimate"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
