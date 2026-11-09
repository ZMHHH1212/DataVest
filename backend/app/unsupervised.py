"""Unsupervised learning on markets.

1. Market map: which stocks move together? PCA on weekly returns, then hierarchical
   clustering on correlation distance, with the number of clusters chosen by silhouette.
   The clusters are compared with sector and region labels (adjusted Rand index).
2. Market regimes: a two-state Gaussian Hidden Markov Model on daily returns, fitted
   with the Baum-Welch (EM) algorithm. One state is "calm" (low volatility), the other
   "turbulent". Filtered probabilities use only past data, so "today's regime" has no
   look-ahead; smoothed probabilities (using the whole sample) are for describing history.
"""
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import squareform
from sklearn.metrics import adjusted_rand_score, silhouette_score

from app import analytics as an


# ---- market map -----------------------------------------------------------------------

def weekly_return_matrix(prices: pd.DataFrame, min_weeks: int = 104) -> pd.DataFrame:
    """Weekly returns, keeping stocks with enough history; remaining gaps filled with 0."""
    w = an.weekly_returns(prices)
    keep = w.columns[w.notna().sum() >= min_weeks]
    return w[keep].dropna(how="all").fillna(0.0)


def pca(returns: pd.DataFrame, n: int = 3) -> dict:
    """Principal components of standardised returns (eigen-decomposition of the correlation matrix)."""
    corr = returns.corr().to_numpy()
    vals, vecs = np.linalg.eigh(corr)
    order = np.argsort(vals)[::-1]
    vals, vecs = vals[order], vecs[:, order]
    # sign convention: the average loading on each component is positive
    vecs = vecs * np.sign(vecs.sum(axis=0, keepdims=True) + 1e-12)
    return {
        "explained": vals[:n] / vals.sum(),
        "loadings": pd.DataFrame(vecs[:, :n], index=returns.columns, columns=[f"PC{i + 1}" for i in range(n)]),
    }


def correlation_distance(returns: pd.DataFrame) -> pd.DataFrame:
    """d = sqrt(2 (1 - rho)): 0 for perfectly correlated, 2 for perfectly opposite."""
    rho = returns.corr().clip(-1, 1)
    return np.sqrt(2 * (1 - rho))


def cluster(returns: pd.DataFrame, k_range=range(2, 6)) -> dict:
    """Average-linkage hierarchical clustering; k chosen by the best silhouette score."""
    dist = correlation_distance(returns)
    condensed = squareform(dist.to_numpy(), checks=False)
    tree = linkage(condensed, method="average")
    scores = {}
    for k in k_range:
        if k >= len(returns.columns):
            break
        labels = fcluster(tree, k, criterion="maxclust")
        if len(set(labels)) < 2:
            continue
        scores[k] = float(silhouette_score(dist.to_numpy(), labels, metric="precomputed"))
    best_k = max(scores, key=scores.get)
    labels = pd.Series(fcluster(tree, best_k, criterion="maxclust"), index=returns.columns, name="cluster")
    # renumber clusters by size (largest = 1) so labels are stable between runs
    sizes = labels.value_counts()
    remap = {old: new for new, old in enumerate(sizes.index, start=1)}
    return {"labels": labels.map(remap), "k": best_k, "silhouette": scores, "linkage": tree}


def agreement(labels: pd.Series, reference: pd.Series) -> float:
    """Adjusted Rand index: 1 = identical grouping, ~0 = no better than random."""
    common = labels.index.intersection(reference.index)
    return float(adjusted_rand_score(reference[common], labels[common]))


# ---- regimes: Gaussian HMM -------------------------------------------------------------

@dataclass
class HMM:
    start: np.ndarray  # (k,)
    trans: np.ndarray  # (k, k), rows sum to 1
    mean: np.ndarray   # (k,)
    var: np.ndarray    # (k,)

    def emissions(self, x: np.ndarray) -> np.ndarray:
        """Gaussian density of each observation under each state, shape (T, k)."""
        z = (x[:, None] - self.mean[None, :]) ** 2 / self.var[None, :]
        return np.exp(-0.5 * z) / np.sqrt(2 * np.pi * self.var[None, :])

    def forward(self, x: np.ndarray):
        """Scaled forward pass. alpha[t] = P(state at t | data up to t)."""
        B = self.emissions(x)
        T, k = B.shape
        alpha = np.empty((T, k))
        scale = np.empty(T)
        a = self.start * B[0]
        scale[0] = a.sum()
        alpha[0] = a / scale[0]
        for t in range(1, T):
            a = (alpha[t - 1] @ self.trans) * B[t]
            scale[t] = a.sum()
            alpha[t] = a / scale[t]
        return alpha, scale, B

    def backward(self, B: np.ndarray, scale: np.ndarray) -> np.ndarray:
        T, k = B.shape
        beta = np.ones((T, k))
        for t in range(T - 2, -1, -1):
            beta[t] = (self.trans @ (B[t + 1] * beta[t + 1])) / scale[t + 1]
        return beta

    def log_likelihood(self, x: np.ndarray) -> float:
        _, scale, _ = self.forward(x)
        return float(np.log(scale).sum())

    def filtered(self, x: np.ndarray) -> np.ndarray:
        return self.forward(x)[0]

    def smoothed(self, x: np.ndarray) -> np.ndarray:
        alpha, scale, B = self.forward(x)
        beta = self.backward(B, scale)
        g = alpha * beta
        return g / g.sum(axis=1, keepdims=True)


def fit_hmm(x: np.ndarray, k: int = 2, n_iter: int = 200, tol: float = 1e-6, seed: int = 0) -> HMM:
    """Baum-Welch (EM). States are sorted by variance: state 0 = calm, state k-1 = turbulent."""
    rng = np.random.default_rng(seed)
    q = np.quantile(np.abs(x), np.linspace(0.3, 0.9, k))
    model = HMM(
        start=np.full(k, 1 / k),
        trans=np.full((k, k), 0.05 / (k - 1)) + np.eye(k) * (0.95 - 0.05 / (k - 1)),
        mean=np.full(k, x.mean()) + rng.normal(0, 1e-4, k),
        var=np.maximum(q**2, 1e-8),
    )
    prev = -np.inf
    floor = x.var() * 1e-3
    for _ in range(n_iter):
        alpha, scale, B = model.forward(x)
        beta = model.backward(B, scale)
        gamma = alpha * beta
        gamma /= gamma.sum(axis=1, keepdims=True)
        # expected transitions
        xi = (alpha[:-1, :, None] * model.trans[None] * (B[1:] * beta[1:])[:, None, :]) / scale[1:, None, None]
        model.start = gamma[0]
        model.trans = xi.sum(axis=0) / gamma[:-1].sum(axis=0)[:, None]
        model.trans /= model.trans.sum(axis=1, keepdims=True)
        w = gamma.sum(axis=0)
        model.mean = (gamma * x[:, None]).sum(axis=0) / w
        model.var = np.maximum((gamma * (x[:, None] - model.mean) ** 2).sum(axis=0) / w, floor)
        ll = float(np.log(scale).sum())
        if ll - prev < tol:
            break
        prev = ll
    order = np.argsort(model.var)
    return HMM(model.start[order], model.trans[np.ix_(order, order)], model.mean[order], model.var[order])


def regimes(close: pd.Series, k: int = 2) -> dict:
    """Fit on daily log returns; return the model and per-day turbulent-state probabilities."""
    r = np.log(close.dropna()).diff().dropna()
    x = r.to_numpy()
    model = fit_hmm(x, k)
    filt = model.filtered(x)
    smooth = model.smoothed(x)
    stay = np.diag(model.trans)
    return {
        "model": model,
        "returns": r,
        "p_turbulent_filtered": pd.Series(filt[:, -1], index=r.index),
        "p_turbulent_smoothed": pd.Series(smooth[:, -1], index=r.index),
        "vol": np.sqrt(model.var * 252),            # annualised volatility per state
        "expected_days": 1 / (1 - stay),             # average length of a spell in each state
        "share_of_time": smooth.mean(axis=0),
    }
