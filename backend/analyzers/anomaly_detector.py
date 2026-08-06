"""Anomaly detection engine using statistical methods.

Uses NumPy for:
- Z-score based outlier detection
- Standard deviation baseline comparison
- Percentile-based thresholds
- Time-series trend analysis
"""
import numpy as np
from typing import Optional


class AnomalyDetector:
    """Statistical anomaly detector using NumPy."""

    def __init__(self, z_score_threshold: float = 3.0):
        """Initialize detector with z-score threshold.

        Args:
            z_score_threshold: Number of standard deviations for outlier detection
        """
        self.z_score_threshold = z_score_threshold

    def detect_zscore_anomalies(
        self, values: list[float], threshold: Optional[float] = None
    ) -> list[bool]:
        """Detect anomalies using Z-score method.

        Values with |z-score| > threshold are flagged as anomalies.

        Args:
            values: List of numeric values
            threshold: Z-score threshold (uses self.z_score_threshold if None)

        Returns:
            List of booleans indicating which values are anomalies
        """
        if threshold is None:
            threshold = self.z_score_threshold

        if len(values) < 2:
            return [False] * len(values)

        arr = np.array(values, dtype=float)
        mean = np.mean(arr)
        std = np.std(arr)

        # Avoid division by zero
        if std == 0:
            return [False] * len(values)

        z_scores = np.abs((arr - mean) / std)
        return (z_scores > threshold).tolist()

    def calculate_statistics(self, values: list[float]) -> dict:
        """Calculate statistical measures for a dataset.

        Args:
            values: List of numeric values

        Returns:
            Dictionary with mean, median, std, min, max, etc.
        """
        if not values:
            return {}

        arr = np.array(values, dtype=float)

        return {
            "count": len(values),
            "mean": float(np.mean(arr)),
            "median": float(np.median(arr)),
            "std": float(np.std(arr)),
            "min": float(np.min(arr)),
            "max": float(np.max(arr)),
            "q25": float(np.percentile(arr, 25)),
            "q75": float(np.percentile(arr, 75)),
            "iqr": float(np.percentile(arr, 75) - np.percentile(arr, 25)),
        }

    def detect_outliers_iqr(self, values: list[float]) -> list[bool]:
        """Detect outliers using Interquartile Range (IQR) method.

        Flags values outside Q1 - 1.5*IQR and Q3 + 1.5*IQR.

        Args:
            values: List of numeric values

        Returns:
            List of booleans indicating which values are outliers
        """
        if len(values) < 4:
            return [False] * len(values)

        arr = np.array(values, dtype=float)
        q1 = np.percentile(arr, 25)
        q3 = np.percentile(arr, 75)
        iqr = q3 - q1

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        return ((arr < lower_bound) | (arr > upper_bound)).tolist()

    def detect_spike(
        self, values: list[float], threshold_multiplier: float = 2.0
    ) -> list[bool]:
        """Detect sudden spikes in time-series data.

        Compares each value to the mean of previous values.

        Args:
            values: List of numeric values in chronological order
            threshold_multiplier: How many times the mean to flag as spike

        Returns:
            List of booleans indicating spike events
        """
        if len(values) < 2:
            return [False] * len(values)

        spikes = []
        for i in range(len(values)):
            if i == 0:
                spikes.append(False)
                continue

            # Compare to mean of previous values
            prev_values = np.array(values[:i], dtype=float)
            prev_mean = np.mean(prev_values)

            if prev_mean == 0:
                spikes.append(False)
                continue

            # Check if current value is significantly higher
            ratio = values[i] / prev_mean
            spikes.append(ratio > threshold_multiplier)

        return spikes

    def detect_trend_shift(
        self, values: list[float], window_size: int = 5
    ) -> list[bool]:
        """Detect shifts in trend using moving average comparison.

        Args:
            values: List of numeric values in chronological order
            window_size: Size of moving average window

        Returns:
            List of booleans indicating shift points
        """
        if len(values) < window_size * 2:
            return [False] * len(values)

        arr = np.array(values, dtype=float)
        shifts = []

        for i in range(len(values)):
            if i < window_size or i >= len(values) - window_size:
                shifts.append(False)
                continue

            # Compare moving averages before and after
            before_window = arr[i - window_size : i]
            after_window = arr[i : i + window_size]

            before_mean = np.mean(before_window)
            after_mean = np.mean(after_window)

            if before_mean == 0:
                shifts.append(False)
                continue

            # Significant change in trend
            change_ratio = abs(after_mean - before_mean) / before_mean
            shifts.append(change_ratio > 0.5)  # 50% change threshold

        return shifts

    @staticmethod
    def percentile_rank(value: float, dataset: list[float]) -> float:
        """Calculate percentile rank of a value in dataset.

        Args:
            value: Value to rank
            dataset: Dataset to compare against

        Returns:
            Percentile rank (0-100)
        """
        if not dataset:
            return 0.0

        arr = np.array(dataset, dtype=float)
        rank = (arr < value).sum() / len(arr) * 100
        return float(rank)
