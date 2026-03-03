"""
Smart Travel Companion Finder Backend

This module loads travel_companion_finder_dataset_.csv.xlsx
using pandas.

Requirements:
- Convert start_date and end_date columns to datetime
- Return DataFrame
- Handle file not found errors
"""

import os
import pandas as pd


def load_dataset(filepath: str = None) -> pd.DataFrame:
    """Load the travel companion finder dataset from a CSV file.

    Args:
        filepath: Path to the CSV file. Defaults to
            travel_companion_finder_dataset.csv in the same directory.

    Returns:
        pd.DataFrame with start_date and end_date as datetime columns.

    Raises:
        FileNotFoundError: If the dataset file does not exist.
    """

    if filepath is None:
        filepath = os.path.join(
            os.path.dirname(__file__),
            "travel_companion_finder_dataset.csv",
        )

    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Dataset not found: {filepath}")

    df = pd.read_csv(filepath)

    # Convert date columns safely
    if "start_date" in df.columns:
        df["start_date"] = pd.to_datetime(
            df["start_date"],
            format="%d-%m-%Y",
            errors="coerce"
        )

    if "end_date" in df.columns:
        df["end_date"] = pd.to_datetime(
            df["end_date"],
            format="%d-%m-%Y",
            errors="coerce"
        )

    return df

