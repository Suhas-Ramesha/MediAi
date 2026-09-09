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
  "Asymptomatic (no chest pain)",
  "Typical angina",
  "Atypical angina",
  "Non-anginal pain",
] as const;

const FBS_OPTIONS = ["No (under 120 mg/dl)", "Yes (over 120 mg/dl)"] as const;

const RESTECG_OPTIONS = [
  "Normal",
  "ST-T wave abnormality",
  "Left ventricular hypertrophy",
] as const;

const SLOPE_OPTIONS = ["Downsloping", "Flat", "Upsloping"] as const;

const THAL_OPTIONS = ["Fixed defect", "Reversible defect", "Normal"] as const;

export function RiskAssessmentModal({
  open,
  onOpenChange,
  disease,
  onSubmit,
  isSubmitting,
}: RiskAssessmentModalProps) {
  const [gender, setGender] = useState<"1" | "0">("1");
  const [smokes, setSmokes] = useState(false);
  const [activity, setActivity] = useState<"low" | "moderate" | "high">("moderate");

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
    cp: "Asymptomatic (no chest pain)" as (typeof CP_OPTIONS)[number],
    trestbps: 130,
    chol: 240,
    fbs: "No (under 120 mg/dl)" as (typeof FBS_OPTIONS)[number],
    restecg: "Normal" as (typeof RESTECG_OPTIONS)[number],
    thalach: 150,
    exang: "No" as "No" | "Yes",
    oldpeak: 1.0,
    slope: "Flat" as (typeof SLOPE_OPTIONS)[number],
    ca: 0,
    thal: "Normal" as (typeof THAL_OPTIONS)[number],
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
    bp: 120,
  });

  const title = useMemo(() => {
    switch (disease) {
      case "diabetes":
        return "Diabetes risk — your numbers";
      case "heart":
        return "Heart disease risk — clinical inputs";
      case "liver":
        return "Liver disease risk — lab values";
      case "kidney":
        return "Kidney disease risk — your numbers";
      default:
        return "Risk assessment";
    }
  }, [disease]);

  const showSmokingActivity = disease === "diabetes" || disease === "kidney";

  const handleSubmit = () => {
    if (!disease) return;
    const lifestyle = { activity, smokes: smokes ? 1 : 0 };
    if (disease === "diabetes") {
      onSubmit({ ...diabetes, ...lifestyle, gender: Number(gender) });
      return;
    }
    if (disease === "heart") {
      onSubmit({
        age: heart.age,
        sex: gender === "1" ? "Male" : "Female",
        cp: heart.cp,
        trestbps: heart.trestbps,
        chol: heart.chol,
        fbs: heart.fbs,
        restecg: heart.restecg,
        thalach: heart.thalach,
        exang: heart.exang,
        oldpeak: heart.oldpeak,
        slope: heart.slope,
        ca: heart.ca,
        thal: heart.thal,
      });
      return;
    }
    if (disease === "liver") {
      onSubmit({
        ...liver,
        Gender: gender === "1" ? "Male" : "Female",
        ...lifestyle,
      });
      return;
    }
    onSubmit({
      creatinine: kidney.creatinine,
      urea: kidney.urea,
      hemoglobin: kidney.hemoglobin,
      bp: kidney.bp,
      gender: Number(gender),
      ...lifestyle,
    });
  };

  const genderBlock = (
    <div className="space-y-2">
      <Label>{disease === "liver" ? "Gender" : "Sex"}</Label>
      <RadioGroup
        value={gender}
        onValueChange={(v) => setGender(v as "1" | "0")}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="0" id="g-f" />
          <Label htmlFor="g-f" className="font-normal">
            Female
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="1" id="g-m" />
          <Label htmlFor="g-m" className="font-normal">
            Male
          </Label>
        </div>
      </RadioGroup>
    </div>
  );

  const smokingActivityBlock = showSmokingActivity && (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Label>Smoking</Label>
          <p className="text-xs text-muted-foreground">General health context</p>
        </div>
        <Select
          value={smokes ? "yes" : "no"}
          onValueChange={(v) => setSmokes(v === "yes")}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="no">No</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Activity level</Label>
        <Select
          value={activity}
          onValueChange={(v) => setActivity(v as typeof activity)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Mostly seated / low</SelectItem>
            <SelectItem value="moderate">Moderate</SelectItem>
            <SelectItem value="high">Very active</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  const aboutYouSection = (disease === "diabetes" ||
    disease === "kidney" ||
    disease === "heart" ||
    disease === "liver") && (
    <div className="space-y-4 rounded-md border bg-muted/40 p-3">
      <p className="text-sm font-medium text-foreground">About you</p>
      {genderBlock}
      {smokingActivityBlock}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Match the fields to your recent readings or best estimate. This is not a
            diagnosis.
          </DialogDescription>
        </DialogHeader>

        {disease === "kidney" && (
          <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            The kidney model is not connected yet. You can still enter values for
            context; we will only give general guidance until the model is available.
          </p>
        )}

        <div className="space-y-6 py-2">
          {disease === "diabetes" && (
            <div className="space-y-4">
              {[
                ["pregnancies", "Pregnancies (number)", 0, 17, 1, diabetes.pregnancies],
                ["glucose", "Glucose (mg/dL)", 50, 200, 1, diabetes.glucose],
                ["bp", "Blood pressure (mm Hg)", 40, 120, 1, diabetes.bp],
                ["skin", "Skin thickness (mm)", 7, 99, 1, diabetes.skin],
                ["insulin", "Insulin (μU/mL)", 0, 300, 1, diabetes.insulin],
                ["bmi", "BMI (kg/m²)", 15, 50, 0.5, diabetes.bmi],
                ["pedigree", "Diabetes pedigree function", 0.08, 2.5, 0.01, diabetes.pedigree],
                ["age", "Age (years)", 18, 90, 1, diabetes.age],
              ].map(([key, label, min, max, step, val]) => (
                <div key={key as string} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>{label}</Label>
                    <span className="tabular-nums text-muted-foreground">
                      {typeof val === "number" ? val : ""}
                    </span>
                  </div>
                  <Slider
                    min={min as number}
                    max={max as number}
                    step={step as number}
                    value={[val as number]}
                    onValueChange={([v]) =>
                      setDiabetes((d) => ({ ...d, [key as string]: v }))
                    }
                  />
                </div>
              ))}
              {aboutYouSection}
            </div>
          )}

          {disease === "heart" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>Age (years)</Label>
                  <span className="text-muted-foreground">{heart.age}</span>
                </div>
                <Slider
                  min={18}
                  max={90}
                  step={1}
                  value={[heart.age]}
                  onValueChange={([v]) => setHeart((h) => ({ ...h, age: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Chest pain type</Label>
                <Select
                  value={heart.cp}
                  onValueChange={(v) =>
                    setHeart((h) => ({ ...h, cp: v as (typeof CP_OPTIONS)[number] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CP_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>Resting blood pressure (mm Hg)</Label>
                  <span className="text-muted-foreground">{heart.trestbps}</span>
                </div>
                <Slider
                  min={80}
                  max={200}
                  step={1}
                  value={[heart.trestbps]}
                  onValueChange={([v]) => setHeart((h) => ({ ...h, trestbps: v }))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>Serum cholesterol (mg/dl)</Label>
                  <span className="text-muted-foreground">{heart.chol}</span>
                </div>
                <Slider
                  min={100}
                  max={600}
                  step={1}
                  value={[heart.chol]}
                  onValueChange={([v]) => setHeart((h) => ({ ...h, chol: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Fasting blood sugar &gt; 120 mg/dl</Label>
                <Select
                  value={heart.fbs}
                  onValueChange={(v) =>
                    setHeart((h) => ({ ...h, fbs: v as (typeof FBS_OPTIONS)[number] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FBS_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Resting ECG</Label>
                <Select
                  value={heart.restecg}
                  onValueChange={(v) =>
                    setHeart((h) => ({
                      ...h,
                      restecg: v as (typeof RESTECG_OPTIONS)[number],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESTECG_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>Maximum heart rate achieved</Label>
                  <span className="text-muted-foreground">{heart.thalach}</span>
                </div>
                <Slider
                  min={60}
                  max={220}
                  step={1}
                  value={[heart.thalach]}
                  onValueChange={([v]) => setHeart((h) => ({ ...h, thalach: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Exercise-induced angina</Label>
                <Select
                  value={heart.exang}
                  onValueChange={(v) => setHeart((h) => ({ ...h, exang: v as "No" | "Yes" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No">No</SelectItem>
                    <SelectItem value="Yes">Yes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>ST depression (oldpeak)</Label>
                  <span className="text-muted-foreground">{heart.oldpeak}</span>
                </div>
                <Slider
                  min={0}
                  max={6.5}
                  step={0.1}
                  value={[heart.oldpeak]}
                  onValueChange={([v]) => setHeart((h) => ({ ...h, oldpeak: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Slope of peak exercise ST segment</Label>
                <Select
                  value={heart.slope}
                  onValueChange={(v) =>
                    setHeart((h) => ({ ...h, slope: v as (typeof SLOPE_OPTIONS)[number] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLOPE_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>Major vessels coloured (0–3)</Label>
                  <span className="text-muted-foreground">{heart.ca}</span>
                </div>
                <Slider
                  min={0}
                  max={3}
                  step={1}
                  value={[heart.ca]}
                  onValueChange={([v]) => setHeart((h) => ({ ...h, ca: v }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Thalassemia</Label>
                <Select
                  value={heart.thal}
                  onValueChange={(v) =>
                    setHeart((h) => ({ ...h, thal: v as (typeof THAL_OPTIONS)[number] }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THAL_OPTIONS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {aboutYouSection}
            </div>
          )}

          {disease === "liver" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <Label>Age (years)</Label>
                  <span className="text-muted-foreground">{liver.Age}</span>
                </div>
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[liver.Age]}
                  onValueChange={([v]) => setLiver((l) => ({ ...l, Age: v }))}
                />
              </div>
              {(
                [
                  ["Total_Bilirubin", "Total bilirubin", 0.1, 25, 0.1, liver.Total_Bilirubin],
                  ["Direct_Bilirubin", "Direct bilirubin", 0.1, 15, 0.1, liver.Direct_Bilirubin],
                  ["Alkaline_Phosphotase", "Alkaline phosphatase", 10, 500, 5, liver.Alkaline_Phosphotase],
                  ["Alamine_Aminotransferase", "ALT", 5, 500, 1, liver.Alamine_Aminotransferase],
                  ["Aspartate_Aminotransferase", "AST", 5, 500, 1, liver.Aspartate_Aminotransferase],
                  ["Total_Protiens", "Total proteins", 2, 9, 0.1, liver.Total_Protiens],
                  ["Albumin", "Albumin", 1, 6, 0.1, liver.Albumin],
                  ["Albumin_and_Globulin_Ratio", "Albumin / globulin ratio", 0.3, 4, 0.05, liver.Albumin_and_Globulin_Ratio],
                ] as const
              ).map(([key, label, min, max, step, val]) => (
                <div key={key} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>{label}</Label>
                    <span className="tabular-nums text-muted-foreground">{val}</span>
                  </div>
                  <Slider
                    min={min}
                    max={max}
                    step={step}
                    value={[val]}
                    onValueChange={([v]) =>
                      setLiver((l) => ({ ...l, [key]: v }))
                    }
                  />
                </div>
              ))}
              {aboutYouSection}
            </div>
          )}

          {disease === "kidney" && (
            <div className="space-y-4">
              {[
                ["creatinine", "Creatinine (mg/dL)", 0.5, 5, 0.1, kidney.creatinine],
                ["urea", "Urea (mg/dL)", 10, 200, 1, kidney.urea],
                ["hemoglobin", "Hemoglobin (g/dL)", 8, 18, 0.1, kidney.hemoglobin],
                ["bp", "Blood pressure (mm Hg systolic)", 80, 200, 1, kidney.bp],
              ].map(([key, label, min, max, step, val]) => (
                <div key={key as string} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label>{label}</Label>
                    <span className="tabular-nums text-muted-foreground">{val as number}</span>
                  </div>
                  <Slider
                    min={min as number}
                    max={max as number}
                    step={step as number}
                    value={[val as number]}
                    onValueChange={([v]) =>
                      setKidney((k) => ({ ...k, [key as string]: v }))
                    }
                  />
                </div>
              ))}
              {aboutYouSection}
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
              "Run estimate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
