#!/usr/bin/env python3
"""Form-payload accuracy tests for the four local disease classifiers.

Old Gradio/slider path treated every numeric increase as higher risk.
These assertions require clinically directed scores on the same fields the
risk modal sends: high hemoglobin / albumin / max heart rate must not raise
risk, and all-sliders-min must not automatically mean low risk.
"""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("TABPFN_MODEL_VERSION", "v2")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ml.form_predict import (  # noqa: E402
    heart_frame,
    kidney_frame,
    liver_frame,
    predict_form,
)
from ml.form_samples import SAMPLES, sample  # noqa: E402


def _pct(disease: str, name: str) -> float:
    return float(predict_form(disease, sample(disease, name))["riskPercent"])


class FormMappingTests(unittest.TestCase):
    def test_heart_ui_strings_match_cleveland_codes(self) -> None:
        row = heart_frame(sample("heart", "form_default")).iloc[0]
        self.assertEqual(row["sex"], 1)
        self.assertEqual(row["cp"], 4)  # asymptomatic
        self.assertEqual(row["fbs"], 0)
        self.assertEqual(row["restecg"], 0)
        self.assertEqual(row["exang"], 0)
        self.assertEqual(row["slope"], 2)
        self.assertEqual(row["thal"], 3)

        typical = heart_frame(sample("heart", "typical_angina_cp")).iloc[0]
        self.assertEqual(typical["cp"], 1)

        diseased = heart_frame(sample("heart", "diseased")).iloc[0]
        self.assertEqual(diseased["thal"], 7)
        self.assertEqual(diseased["restecg"], 2)
        self.assertEqual(diseased["exang"], 1)

    def test_liver_ui_names_map_to_ilpd_columns(self) -> None:
        row = liver_frame(sample("liver", "form_default")).iloc[0]
        self.assertEqual(row["Gender"], "Male")
        self.assertAlmostEqual(float(row["TB"]), 1.2)
        self.assertAlmostEqual(float(row["Sgpt"]), 40)
        self.assertAlmostEqual(float(row["ALB"]), 3.5)
        self.assertAlmostEqual(float(row["AG"]), 1.2)

    def test_kidney_ui_labs_map_onto_uci_frame(self) -> None:
        row = kidney_frame(sample("kidney", "form_default")).iloc[0]
        self.assertAlmostEqual(float(row["sc"]), 1.0)
        self.assertAlmostEqual(float(row["bu"]), 30)
        self.assertAlmostEqual(float(row["hemo"]), 14)
        self.assertAlmostEqual(float(row["bp"]), 120)
        self.assertEqual(row["rbc"], "normal")
        self.assertEqual(row["htn"], "no")
        self.assertEqual(row["ane"], "no")
        self.assertAlmostEqual(float(row["pcv"]), 42.0)

        anemic = kidney_frame(sample("kidney", "low_hemoglobin_only")).iloc[0]
        self.assertEqual(anemic["ane"], "yes")
        self.assertLess(float(anemic["pcv"]), 30)


class DiabetesFormTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.scores = {name: _pct("diabetes", name) for name, _ in SAMPLES["diabetes"]}

    def test_diseased_vs_healthy(self) -> None:
        self.assertLess(self.scores["healthy"], 20)
        self.assertGreater(self.scores["diseased_pima_like"], 70)
        self.assertGreater(
            self.scores["diseased_pima_like"] - self.scores["healthy"], 50
        )

    def test_glucose_drives_more_than_bmi_alone(self) -> None:
        # Not the old "any high slider = high risk" rule.
        self.assertGreater(self.scores["high_glucose_only"], 40)
        self.assertLess(self.scores["high_bmi_normal_glucose"], 25)
        self.assertGreater(
            self.scores["high_glucose_only"] - self.scores["high_bmi_normal_glucose"],
            20,
        )

    def test_form_default_is_not_high(self) -> None:
        self.assertLess(self.scores["form_default"], 25)


class HeartFormTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.scores = {name: _pct("heart", name) for name, _ in SAMPLES["heart"]}

    def test_diseased_vs_healthy(self) -> None:
        self.assertLess(self.scores["healthy"], 15)
        self.assertGreater(self.scores["diseased"], 85)

    def test_high_max_heart_rate_is_protective(self) -> None:
        # thalach high must NOT raise risk the way the old monotonic sliders did.
        self.assertGreater(self.scores["low_thalach_bad"], self.scores["high_thalach_good"])

    def test_asymptomatic_is_higher_risk_than_typical_angina(self) -> None:
        self.assertGreater(self.scores["asymptomatic_cp"], self.scores["typical_angina_cp"])


class LiverFormTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.scores = {name: _pct("liver", name) for name, _ in SAMPLES["liver"]}

    def test_diseased_vs_healthy(self) -> None:
        self.assertGreater(self.scores["diseased"], 80)
        self.assertGreater(self.scores["diseased"] - self.scores["healthy"], 20)

    def test_low_albumin_is_not_treated_as_safer(self) -> None:
        # High albumin is healthier; the old all-sliders-up rule got this backwards.
        self.assertGreaterEqual(
            self.scores["low_albumin_only"], self.scores["high_albumin_only"]
        )

    def test_high_alt_raises_vs_healthy_panel(self) -> None:
        self.assertGreater(self.scores["high_alt_only"], self.scores["healthy"])


class KidneyFormTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.scores = {name: _pct("kidney", name) for name, _ in SAMPLES["kidney"]}

    def test_diseased_vs_healthy(self) -> None:
        self.assertLess(self.scores["healthy"], 15)
        self.assertGreater(self.scores["diseased"], 90)

    def test_all_min_is_not_automatically_low_risk(self) -> None:
        # Hemoglobin at the slider floor (8 g/dL) is anemia — high CKD risk.
        # All-sliders-max is *not* the top score because hemoglobin 18 is protective.
        self.assertGreater(self.scores["all_slider_min"], 80)
        self.assertGreater(self.scores["all_slider_min"], self.scores["all_slider_max"])
        self.assertGreater(self.scores["diseased"], self.scores["all_slider_max"])

    def test_high_hemoglobin_lowers_risk(self) -> None:
        self.assertLess(self.scores["high_hemoglobin_only"], 15)
        self.assertGreater(self.scores["low_hemoglobin_only"], 80)
        self.assertGreater(
            self.scores["low_hemoglobin_only"] - self.scores["high_hemoglobin_only"],
            50,
        )

    def test_high_creatinine_raises_risk(self) -> None:
        self.assertGreater(
            self.scores["high_creatinine_only"], self.scores["form_default"]
        )
        self.assertLess(self.scores["form_default"], 15)


if __name__ == "__main__":
    unittest.main(verbosity=2)
