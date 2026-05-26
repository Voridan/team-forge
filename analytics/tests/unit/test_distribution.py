from app.math.distribution import iqr_fence, max_median_ratio


class TestMaxMedianRatio:
    def test_empty_returns_none(self):
        assert max_median_ratio([]) is None

    def test_zero_median_returns_none(self):
        # Everyone with 0 open tasks → ratio is undefined
        assert max_median_ratio([0, 0, 0, 0]) is None

    def test_perfectly_even_returns_1(self):
        assert max_median_ratio([5, 5, 5, 5]) == 1.0

    def test_imbalance(self):
        # median = 2, max = 6 → ratio = 3.0
        assert max_median_ratio([6, 2, 2, 2]) == 3.0

    def test_single_value(self):
        assert max_median_ratio([10]) == 1.0


class TestIqrFence:
    def test_too_few_returns_no_outliers(self):
        result = iqr_fence([1, 2, 3])
        assert result.upper_fence is None
        assert result.overloaded_indices == []

    def test_evenly_distributed_no_outliers(self):
        # IQR is small, no values above Q3 + 1.5*IQR
        result = iqr_fence([5, 5, 5, 5, 5, 5])
        assert result.overloaded_indices == []

    def test_one_obvious_outlier(self):
        # [1,1,1,1,1,50] — 50 is far above the fence
        result = iqr_fence([1, 1, 1, 1, 1, 50])
        assert result.upper_fence is not None
        assert result.overloaded_indices == [5]

    def test_multiple_outliers(self):
        # The two large values both exceed the fence
        result = iqr_fence([1, 1, 1, 1, 1, 1, 30, 50])
        assert 6 in result.overloaded_indices
        assert 7 in result.overloaded_indices

    def test_outlier_indices_are_sorted(self):
        # Out-of-order outliers in the source list
        result = iqr_fence([50, 1, 1, 1, 1, 30, 1, 1])
        # 0 and 5 should both be flagged, sorted ascending
        assert result.overloaded_indices == sorted(result.overloaded_indices)
