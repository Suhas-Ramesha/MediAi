import React, { useMemo, useState } from "react";
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
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const shown = Number.isInteger(step) && step >= 1 ? value : Number(value.toFixed(2));
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-3 text-sm">
        <div>
          <Label>{label}</Label>
          {hint ? <p className="mt-0.5 text-xs font-normal text-muted-foreground">{hint}</p> : null}
        </div>
        <span className="shrink-0 tabular-nums text-muted-foreground">{shown}</span>
      </div>
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
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
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

  const [diabetes, setDiabetes] = useState({
    pregnancies: 0,
    glucose: 100,
    bp: 70,
    skin: 20,
    insulin: 80,
    bmi: 25,
    pedigree: 0.5,
    age: 30,
  });

  const [heart, setHeart] = useState({
    age: 54,
    cp: "No chest pain or tightness",
    trestbps: 130,
    chol: 240,
    fbs: "I don't have this number",
    restecg: "I don't know",
    thalach: 150,
    exang: "No",
    oldpeak: 1.0,
    slope: "I don't know",
    ca: "0",
    thal: "I don't know",
  });

  const [liver, setLiver] = useState({
    Age: 45,
    Total_Bilirubin: 1.2,
    Direct_Bilirubin: 0.4,
    Alkaline_Phosphotase: 200,
    Alamine_Aminotransferase: 40,
    Aspartate_Aminotransferase: 35,
    Total_Protiens: 6.5,
    Albumin: 3.5,
    Albumin_and_Globulin_Ratio: 1.2,
  });

  const [kidney, setKidney] = useState({
    creatinine: 1,
    urea: 30,
    hemoglobin: 14,
    bp: 80,
  });

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
                label="Blood sugar (glucose)"
                hint="From a lab slip, in mg/dL. Around 70–99 is often usual when fasting."
                min={50}
                max={200}
                step={1}
                value={diabetes.glucose}
                onChange={(v) => setDiabetes((d) => ({ ...d, glucose: v }))}
              />
              <SliderField
                label="Blood pressure"
                hint="A cuff reading, in mm Hg."
                min={40}
                max={120}
                step={1}
                value={diabetes.bp}
                onChange={(v) => setDiabetes((d) => ({ ...d, bp: v }))}
              />
              <SliderField
                label="Skin-fold thickness"
                hint="A pinch of skin at the back of the upper arm, in mm. Leave near 20 if never measured."
                min={7}
                max={99}
                step={1}
                value={diabetes.skin}
                onChange={(v) => setDiabetes((d) => ({ ...d, skin: v }))}
              />
              <SliderField
                label="Insulin level"
                hint="From a blood test, in μU/mL. Leave near 80 if you do not have this."
                min={0}
                max={300}
                step={1}
                value={diabetes.insulin}
                onChange={(v) => setDiabetes((d) => ({ ...d, insulin: v }))}
              />
              <SliderField
                label="Body mass index (BMI)"
                hint="Weight in kg ÷ height in metres squared. 18.5–24.9 is often called a usual range."
                min={15}
                max={50}
                step={0.5}
                value={diabetes.bmi}
                onChange={(v) => setDiabetes((d) => ({ ...d, bmi: v }))}
              />
              <SliderField
                label="Diabetes in your close family"
                hint="Low (left) if almost nobody has it. Higher if parents or siblings do."
                min={0.08}
                max={2.5}
                step={0.01}
                value={diabetes.pedigree}
                onChange={(v) => setDiabetes((d) => ({ ...d, pedigree: v }))}
              />
              <SliderField
                label="Your age"
                hint="In years."
                min={18}
                max={90}
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
                max={90}
                step={1}
                value={heart.age}
                onChange={(v) => setHeart((h) => ({ ...h, age: v }))}
              />
              <Choice
                label="When you get chest discomfort, what is it like?"
                hint="Pick the closest match, or I’m not sure."
                value={heart.cp}
                onChange={(v) => setHeart((h) => ({ ...h, cp: v }))}
                options={CP_OPTIONS}
              />
              <SliderField
                label="Blood pressure while resting"
                hint="The upper number from a cuff, in mm Hg, sitting quietly."
                min={80}
                max={200}
                step={1}
                value={heart.trestbps}
                onChange={(v) => setHeart((h) => ({ ...h, trestbps: v }))}
              />
              <SliderField
                label="Cholesterol in your blood"
                hint="Total cholesterol from a lab slip, in mg/dL."
                min={100}
                max={600}
                step={1}
                value={heart.chol}
                onChange={(v) => setHeart((h) => ({ ...h, chol: v }))}
              />
              <Choice
                label="Fasting blood sugar"
                hint="A sugar test after not eating overnight."
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
                hint="Beats per minute during hard activity. About 150 if you do not know."
                min={60}
                max={220}
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
                label="How much the exercise-test line dipped"
                hint="A hospital number called ST depression. Leave at 1.0 if you never had this test."
                min={0}
                max={6.5}
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
                hint="Only use 1–3 if a cardiologist told you how many arteries were narrowed."
                value={heart.ca}
                onChange={(v) => setHeart((h) => ({ ...h, ca: v }))}
                options={CA_OPTIONS}
              />
              <Choice
                label="Special heart blood-flow scan"
                hint="Sometimes listed as thalassemia on old reports. Use I don’t know if you never had this."
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
                min={1}
                max={100}
                step={1}
                value={liver.Age}
                onChange={(v) => setLiver((l) => ({ ...l, Age: v }))}
              />
              <SliderField
                label="Yellow pigment in blood (total bilirubin)"
                hint="On the report as total bilirubin, mg/dL. Often under 1.2 when usual."
                min={0.1}
                max={25}
                step={0.1}
                value={liver.Total_Bilirubin}
                onChange={(v) => setLiver((l) => ({ ...l, Total_Bilirubin: v }))}
              />
              <SliderField
                label="Direct bilirubin"
                hint="The second bilirubin number, mg/dL."
                min={0.1}
                max={15}
                step={0.1}
                value={liver.Direct_Bilirubin}
                onChange={(v) => setLiver((l) => ({ ...l, Direct_Bilirubin: v }))}
              />
              <SliderField
                label="ALP — a liver and bone enzyme"
                hint="Alkaline phosphatase, U/L."
                min={10}
                max={500}
                step={5}
                value={liver.Alkaline_Phosphotase}
                onChange={(v) => setLiver((l) => ({ ...l, Alkaline_Phosphotase: v }))}
              />
              <SliderField
                label="ALT — a liver enzyme"
                hint="Also written SGPT, U/L."
                min={5}
                max={500}
                step={1}
                value={liver.Alamine_Aminotransferase}
                onChange={(v) => setLiver((l) => ({ ...l, Alamine_Aminotransferase: v }))}
              />
              <SliderField
                label="AST — a liver enzyme"
                hint="Also written SGOT, U/L."
                min={5}
                max={500}
                step={1}
                value={liver.Aspartate_Aminotransferase}
                onChange={(v) => setLiver((l) => ({ ...l, Aspartate_Aminotransferase: v }))}
              />
              <SliderField
                label="Total protein in blood"
                hint="g/dL. Often around 6–8."
                min={2}
                max={9}
                step={0.1}
                value={liver.Total_Protiens}
                onChange={(v) => setLiver((l) => ({ ...l, Total_Protiens: v }))}
              />
              <SliderField
                label="Albumin — a helpful blood protein"
                hint="g/dL. Higher is usually healthier."
                min={1}
                max={6}
                step={0.1}
                value={liver.Albumin}
                onChange={(v) => setLiver((l) => ({ ...l, Albumin: v }))}
              />
              <SliderField
                label="Albumin compared with globulin"
                hint="A/G ratio on the report. Around 1–2 is common."
                min={0.3}
                max={4}
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
                hint="Kidney waste in blood, mg/dL. Often around 0.7–1.3."
                min={0.4}
                max={15}
                step={0.1}
                value={kidney.creatinine}
                onChange={(v) => setKidney((k) => ({ ...k, creatinine: v }))}
              />
              <SliderField
                label="Urea (or BUN / blood urea)"
                hint="Another kidney waste number, mg/dL."
                min={10}
                max={400}
                step={1}
                value={kidney.urea}
                onChange={(v) => setKidney((k) => ({ ...k, urea: v }))}
              />
              <SliderField
                label="Hemoglobin"
                hint="The oxygen-carrying part of blood, g/dL. Higher is usually healthier."
                min={3}
                max={18}
                step={0.1}
                value={kidney.hemoglobin}
                onChange={(v) => setKidney((k) => ({ ...k, hemoglobin: v }))}
              />
              <SliderField
                label="Lower blood-pressure number (diastolic)"
                hint="The bottom number on a cuff, such as 80 in 120/80."
                min={40}
                max={180}
                step={1}
                value={kidney.bp}
                onChange={(v) => setKidney((k) => ({ ...k, bp: v }))}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
