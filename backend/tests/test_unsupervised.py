import numpy as np
import pandas as pd
import pytest

from app import unsupervised as un


def block_prices(n_weeks=260, seed=0):
    """Three groups of stocks; members of a group share a common factor."""
    rng = np.random.default_rng(seed)
    days = pd.bdate_range("2021-01-01", periods=n_weeks * 5)
    factors = {g: rng.normal(0, 0.012, len(days)) for g in "ABC"}
    cols, truth = {}, {}
    for g, n in [("A", 5), ("B", 4), ("C", 3)]:
        for i in range(n):
            r = factors[g] + rng.normal(0, 0.006, len(days))
            cols[f"{g}{i}"] = 100 * np.exp(np.cumsum(r))
            truth[f"{g}{i}"] = g
    return pd.DataFrame(cols, index=days), pd.Series(truth)


def test_clustering_recovers_known_groups():
    prices, truth = block_prices()
    w = un.weekly_return_matrix(prices)
    res = un.cluster(w)
    assert res["k"] == 3
    assert un.agreement(res["labels"], truth) == pytest.approx(1.0)
    assert res["labels"].value_counts().iloc[0] == 5  # largest cluster is numbered 1


def test_pca_first_component_is_market_wide_when_all_share_a_factor():
    rng = np.random.default_rng(1)
    days = pd.bdate_range("2021-01-01", periods=800)
    market = rng.normal(0, 0.01, len(days))
    prices = pd.DataFrame({f"S{i}": 100 * np.exp(np.cumsum(market + rng.normal(0, 0.005, len(days)))) for i in range(8)}, index=days)
    p = un.pca(un.weekly_return_matrix(prices))
    assert p["explained"][0] > 0.6
    assert (p["loadings"]["PC1"] > 0).all()


def test_correlation_distance_range():
    prices, _ = block_prices(120)
    d = un.correlation_distance(un.weekly_return_matrix(prices))
    assert np.allclose(np.diag(d), 0, atol=1e-7)
    assert (d.to_numpy() >= -1e-9).all() and (d.to_numpy() <= 2 + 1e-9).all()


def simulate_regimes(T=4000, seed=2):
    rng = np.random.default_rng(seed)
    trans = np.array([[0.98, 0.02], [0.05, 0.95]])
    sd = np.array([0.007, 0.022])
    s = np.zeros(T, dtype=int)
    for t in range(1, T):
        s[t] = rng.choice(2, p=trans[s[t - 1]])
    return rng.normal(0, sd[s]), s, trans, sd


def test_hmm_recovers_two_regimes():
    x, s, trans, sd = simulate_regimes()
    m = un.fit_hmm(x)
    assert np.sqrt(m.var) == pytest.approx(sd, rel=0.1)
    assert m.trans[0, 0] == pytest.approx(trans[0, 0], abs=0.01)
    assert m.trans[1, 1] == pytest.approx(trans[1, 1], abs=0.03)
    accuracy = ((m.smoothed(x)[:, 1] > 0.5).astype(int) == s).mean()
    assert accuracy > 0.9


def test_hmm_forward_matches_brute_force_likelihood():
    m = un.HMM(np.array([0.6, 0.4]), np.array([[0.9, 0.1], [0.2, 0.8]]), np.array([0.0, 0.0]), np.array([1.0, 4.0]))
    x = np.array([0.3, -1.2, 2.5])
    import itertools
    total = 0.0
    for path in itertools.product([0, 1], repeat=3):
        p = m.start[path[0]] * m.emissions(x[:1])[0, path[0]]
        for t in range(1, 3):
            p *= m.trans[path[t - 1], path[t]] * m.emissions(x[t:t + 1])[0, path[t]]
        total += p
    assert m.log_likelihood(x) == pytest.approx(np.log(total))


def test_filtered_probabilities_do_not_use_the_future():
    x, *_ = simulate_regimes(1000, seed=3)
    m = un.fit_hmm(x)
    a = m.filtered(x)[:500]
    b = m.filtered(np.concatenate([x[:500], x[500:] * 5]))[:500]
    assert np.allclose(a, b)


def test_regimes_summary():
    x, *_ = simulate_regimes(1500, seed=4)
    close = pd.Series(100 * np.exp(np.cumsum(x)), index=pd.bdate_range("2020-01-01", periods=1500))
    res = un.regimes(close)
    assert res["vol"][1] > res["vol"][0]
    assert res["p_turbulent_filtered"].between(0, 1).all()
    assert res["share_of_time"].sum() == pytest.approx(1)
