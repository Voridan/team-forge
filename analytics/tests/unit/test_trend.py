import pytest

from app.math.trend import moving_average, pop_delta_pct, regression_slope, z_score


class TestMovingAverage:
    def test_window_must_be_positive(self):
        with pytest.raises(ValueError):
            moving_average([1, 2, 3], 0)

    def test_first_indices_below_window_are_none(self):
        out = moving_average([1, 2, 3, 4, 5], 3)
        assert out[0] is None
        assert out[1] is None
        assert out[2] == 2.0  # (1+2+3)/3
        assert out[3] == 3.0  # (2+3+4)/3
        assert out[4] == 4.0  # (3+4+5)/3

    def test_window_equal_to_length(self):
        out = moving_average([2, 4, 6, 8], 4)
        assert out[:3] == [None, None, None]
        assert out[3] == 5.0  # (2+4+6+8)/4


class TestPopDeltaPct:
    def test_empty_baseline_returns_none(self):
        assert pop_delta_pct(10, []) is None

    def test_zero_mean_baseline_returns_none(self):
        assert pop_delta_pct(10, [0, 0, 0]) is None

    def test_positive_delta(self):
        # latest=12, baseline mean=10 → +20%
        assert pop_delta_pct(12, [8, 10, 12]) == 20.0

    def test_negative_delta(self):
        # latest=8, baseline mean=10 → -20%
        assert pop_delta_pct(8, [8, 10, 12]) == -20.0


class TestRegressionSlope:
    def test_too_few_points_returns_none(self):
        assert regression_slope([]) is None
        assert regression_slope([1]) is None

    def test_perfectly_linear_increasing(self):
        # y = 2x + 1, slope = 2
        assert regression_slope([1, 3, 5, 7, 9]) == pytest.approx(2.0)

    def test_perfectly_linear_decreasing(self):
        # slope = -1
        assert regression_slope([5, 4, 3, 2, 1]) == pytest.approx(-1.0)

    def test_flat_returns_zero_slope(self):
        assert regression_slope([7, 7, 7, 7, 7]) == 0.0


class TestZScore:
    def test_too_few_baseline_returns_none(self):
        assert z_score(10, []) is None
        assert z_score(10, [5]) is None

    def test_zero_variance_baseline_returns_none(self):
        assert z_score(10, [5, 5, 5]) is None

    def test_z_score_above_mean(self):
        # baseline mean 5, stdev = sqrt(((4-5)^2+(5-5)^2+(6-5)^2)/3) = sqrt(2/3)
        # latest=8 → z = (8-5)/sqrt(2/3) ≈ 3.674
        result = z_score(8, [4, 5, 6])
        assert result is not None
        assert result == pytest.approx(3.674, abs=0.01)

    def test_z_score_at_mean_is_zero(self):
        assert z_score(5, [4, 5, 6]) == 0.0
