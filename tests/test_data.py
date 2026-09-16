import unittest
from pathlib import Path

from scripts.validate_data import run_validation


class GeneratedDataTest(unittest.TestCase):
    def test_contracts_and_stories(self):
        database = Path(__file__).resolve().parents[1] / "data" / "ecommerce.duckdb"
        self.assertTrue(database.exists(), "Run python scripts/generate_data.py first")
        self.assertEqual(run_validation(database, verbose=False), [])


if __name__ == "__main__":
    unittest.main()
