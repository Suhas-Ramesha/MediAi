"""Guard rails for the extra-data accuracy pass."""
from __future__ import annotations

import unittest
from pathlib import Path

from ml.data_prep import KIDNEY_FORM_FEATURES, load_diabetes, load_kidney, load_pabna

ROOT = Path(__file__).resolve().parents[1]


class ExtraDataPoolTests(unittest.TestCase):
    def test_pabna_is_pooled_and_not_a_pima_clone(self) -> None:
        pab = load_pabna()
        self.assertGreater(len(pab), 400)
        self.assertEqual(set(pab["source"].unique()), {"pabna"})
        dia = load_diabetes()
        self.assertIn("pabna", set(dia["source"]))
        self.assertIn("pima", set(dia["source"]))
        self.assertIn("nhanes", set(dia["source"]))
        pima = dia.loc[dia["source"] == "pima"]
        pabna = dia.loc[dia["source"] == "pabna"]
        keys_p = set(zip(pima["glucose"].round(1), pima["age"].round(0), pima["bmi"].round(1)))
        keys_b = set(zip(pabna["glucose"].round(1), pabna["age"].round(0), pabna["bmi"].round(1)))
        self.assertEqual(len(keys_p & keys_b), 0)
        # form slider range
        self.assertLessEqual(float(pabna["pedigree"].max()), 2.51)
        self.assertLess(float(pabna["skin"].median()), 80)
        self.assertGreater(float(pabna["skin"].median()), 10)

    def test_rejected_clones_are_not_in_data(self) -> None:
        raw = ROOT / "data/diabetes/raw"
        names = {p.name.lower() for p in raw.iterdir()}
        self.assertTrue(any("pabna" in n for n in names))
        self.assertFalse(any("frankfurt" in n for n in names))
        self.assertFalse(any("iraqi" in n for n in names))
        self.assertFalse(any("diabd" in n for n in names))

    def test_kidney_form_is_four_labs(self) -> None:
        self.assertEqual(KIDNEY_FORM_FEATURES, ["sc", "bu", "hemo", "bp"])
        pool, _ = load_kidney()
        for col in KIDNEY_FORM_FEATURES:
            self.assertIn(col, pool.columns)


if __name__ == "__main__":
    unittest.main()
