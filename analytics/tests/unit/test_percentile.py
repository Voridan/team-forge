import pytest

from app.math.percentile import safe_median, safe_percentile


class TestSafePercentile:
    def test_empty_returns_none(self):
        assert safe_percentile([], 50) is None

    def test_single_value_returns_that_value_regardless_of_q(self):
        assert safe_percentile([42.0], 0) == 42.0
        assert safe_percentile([42.0], 50) == 42.0
        assert safe_percentile([42.0], 100) == 42.0

    def test_p50_of_sorted_odd_count(self):
        # median of [1,2,3,4,5] is 3
        assert safe_percentile([1, 2, 3, 4, 5], 50) == 3.0

    def test_p50_of_sorted_even_count_interpolates(self):
        # median of [1,2,3,4] is 2.5
        assert safe_percentile([1, 2, 3, 4], 50) == 2.5

    def test_p75_linear_interpolation(self):
        # [1,2,3,4,5], rank = 0.75 * 4 = 3 → exactly index 3 = 4.0
        assert safe_percentile([1, 2, 3, 4, 5], 75) == 4.0

    def test_p25_linear_interpolation(self):
        # [1,2,3,4,5], rank = 0.25 * 4 = 1 → exactly index 1 = 2.0
        assert safe_percentile([1, 2, 3, 4, 5], 25) == 2.0

    def test_unsorted_input_is_handled(self):
        assert safe_percentile([5, 3, 1, 4, 2], 50) == 3.0

    def test_out_of_range_q_raises(self):
        with pytest.raises(ValueError):
            safe_percentile([1, 2, 3], -1)
        with pytest.raises(ValueError):
            safe_percentile([1, 2, 3], 101)

    def test_all_equal_values(self):
        assert safe_percentile([7, 7, 7, 7], 50) == 7.0
        assert safe_percentile([7, 7, 7, 7], 95) == 7.0


class TestSafeMedian:
    def test_empty_returns_none(self):
        assert safe_median([]) is None

    def test_odd_count(self):
        assert safe_median([1, 2, 3]) == 2.0

    def test_even_count(self):
        assert safe_median([1, 2, 3, 4]) == 2.5
