"""Machine-learning forecasts of next month's volatility.

One *global* model is trained on all markets together (a panel), which gives it far
more examples than a per-market model. Three learners, from simple to flexible:

- ridge  regularised linear regression on standardised features
- gbm    gradient-boosted trees (scikit-learn HistGradientBoostingRegressor)
- mlp    a small neural network on standardised features

With only a few thousand training rows, the flexible models need strong regularisation
(shallow trees, early stopping, weight decay) or they overfit.

Target: log of the average squared daily return over the next h days. Logs make the
target roughly symmetric, so squared-error training behaves; predictions are converted
back with a "smearing" correction so they are not biased low.

Leakage controls
- every feature on day t uses data up to day t only
- US-market features are lagged one trading day, because Hong Kong closes before New York
  opens on the same calendar date
- purging: a training row is used only if its h-day target window ended on or before the
  refit date
"""
import numpy as np
import pandas as pd
from scipy.signal import lfilter
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.inspection import permutation_importance
from sklearn.neural_network import MLPRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.forecast import TRADING_DAYS, log_returns

ML_MODELS = ["ridge", "gbm", "mlp"]
MARKET = "^GSPC"
EPS = 1e-10

FEATURE_LABELS = {
    "lrv_1": "Yesterday's move (size)",
    "lrv_5": "Volatility, last week",
    "lrv_22": "Volatility, last month",
    "lrv_66": "Volatility, last 3 months",
    "lrv_all": "Volatility, all history so far",
    "lewma": "Recent-weighted volatility (EWMA)",
    "down_22": "Size of falls, last month",
    "ret_5": "Return, last week",
    "ret_22": "Return, last month",
    "mkt_lrv_22": "US market volatility, last month",
    "mkt_ret_5": "US market return, last week",
    "is_hk": "Hong Kong market",
}
FEATURES = list(FEATURE_LABELS)


def symbol_features(close: pd.Series, h: int = 21) -> pd.DataFrame:
    """Features and target for one market, on its own trading calendar."""
    r = log_returns(close)
    sq = r.pow(2)
    f = pd.DataFrame(index=r.index)
    # floor at a 0.1% move: log of a near-zero day would otherwise be an extreme outlier
    f["lrv_1"] = np.log(sq + 1e-6)
    for w in (5, 22, 66):
        f[f"lrv_{w}"] = np.log(sq.rolling(w, min_periods=w).mean() + EPS)
    # expanding, not a fixed 1-year window, so the first year of data isn't thrown away
    f["lrv_all"] = np.log(sq.expanding(min_periods=22).mean() + EPS)
    ewma = lfilter([0.06], [1, -0.94], sq.to_numpy(), zi=[0.94 * sq.iloc[:22].mean()])[0]
    f["lewma"] = np.log(ewma + EPS)
    f["down_22"] = np.log(sq.where(r < 0, 0).rolling(22, min_periods=22).mean() + EPS)
    f["ret_5"] = r.rolling(5).sum()
    f["ret_22"] = r.rolling(22).sum()

    ahead = sq[::-1].rolling(h, min_periods=h).mean()[::-1].shift(-1)  # mean r^2 over t+1..t+h
    f["y"] = np.log(ahead + EPS)
    f["target_vol"] = np.sqrt(ahead * TRADING_DAYS)
    # position-based end of the target window, so purging works on each market's own calendar
    end_pos = np.arange(len(f)) + h
    f["target_end"] = pd.Series(
        [f.index[p] if p < len(f) else pd.NaT for p in end_pos], index=f.index
    )
    return f


def build_panel(prices: pd.DataFrame, h: int = 21) -> pd.DataFrame:
    """Long table (date, symbol) with features, target and target window end."""
    market = None
    if MARKET in prices:
        m = log_returns(prices[MARKET].dropna())
        market = pd.DataFrame({
            "mkt_lrv_22": np.log(m.pow(2).rolling(22, min_periods=22).mean() + EPS),
            "mkt_ret_5": m.rolling(5).sum(),
        }).shift(1)  # lag one US trading day: no peeking at a US close that hadn't happened yet

    frames = []
    for sym in prices.columns:
        f = symbol_features(prices[sym].dropna(), h)
        if market is not None:
            f = f.join(market.reindex(f.index, method="ffill"))
        else:
            f["mkt_lrv_22"] = np.nan
            f["mkt_ret_5"] = np.nan
        f["is_hk"] = float(sym.endswith(".HK") or sym == "^HSI")
        f["symbol"] = sym
        frames.append(f)
    panel = pd.concat(frames).rename_axis("date").reset_index()
    return panel.dropna(subset=[c for c in FEATURES if not c.startswith("mkt_")])


def make_model(name: str, seed: int = 0):
    if name == "ridge":
        return make_pipeline(StandardScaler(), Ridge(alpha=1.0))
    if name == "gbm":
        return HistGradientBoostingRegressor(
            max_iter=500, learning_rate=0.03, max_leaf_nodes=7, min_samples_leaf=150,
            l2_regularization=5.0, early_stopping=True, validation_fraction=0.15,
            n_iter_no_change=30, random_state=seed,
        )
    if name == "mlp":
        return make_pipeline(
            StandardScaler(),
            MLPRegressor(hidden_layer_sizes=(16,), alpha=0.05, learning_rate_init=1e-3,
                         early_stopping=True, validation_fraction=0.15, n_iter_no_change=20,
                         max_iter=1000, random_state=seed),
        )
    raise ValueError(name)


def _fill(X: pd.DataFrame, medians: pd.Series) -> pd.DataFrame:
    return X.fillna(medians)


def walk_forward_ml(prices: pd.DataFrame, h: int = 21, min_train: int = 500, refit_every: int = 63,
                    models: list[str] = ML_MODELS) -> pd.DataFrame:
    """Out-of-sample forecasts (annualised vol) for every (date, symbol) after the warm-up.

    Refit dates are on the combined calendar. Training uses only rows whose target
    window ended on or before the refit date.
    """
    panel = build_panel(prices, h)
    dates = pd.DatetimeIndex(sorted(panel["date"].unique()))
    out = []
    for k in range(min_train, len(dates), refit_every):
        refit = dates[k - 1]  # the last day whose close is known when refitting
        until = dates[min(k - 1 + refit_every, len(dates) - 1)]
        train = panel[(panel["target_end"] <= refit) & panel["y"].notna()]
        test = panel[(panel["date"] >= refit) & (panel["date"] < until)] if until > refit else panel[panel["date"] >= refit]
        if len(train) < 200 or test.empty:
            continue
        med = train[FEATURES].median()
        Xtr, ytr = _fill(train[FEATURES], med), train["y"]
        Xte = _fill(test[FEATURES], med)
        block = test[["date", "symbol", "target_vol"]].copy()
        for name in models:
            model = make_model(name).fit(Xtr, ytr)
            resid = ytr - model.predict(Xtr)
            smear = float(np.mean(np.exp(resid)))  # Duan's smearing: unbiased back-transform
            block[name] = np.sqrt(np.exp(model.predict(Xte)) * smear * TRADING_DAYS)
        out.append(block)
    res = pd.concat(out, ignore_index=True)
    return res.drop_duplicates(["date", "symbol"], keep="first")


def feature_importance(prices: pd.DataFrame, h: int = 21, holdout_days: int = 250, seed: int = 0) -> pd.Series:
    """Permutation importance of the gradient-boosting model on the most recent year.

    How much worse the model gets (in R^2 on the log target) when one feature is shuffled.
    """
    panel = build_panel(prices, h).dropna(subset=["y"])
    dates = pd.DatetimeIndex(sorted(panel["date"].unique()))
    cut = dates[-holdout_days] if len(dates) > holdout_days + 300 else dates[len(dates) // 2]
    train = panel[panel["target_end"] <= cut]
    test = panel[panel["date"] > cut]
    med = train[FEATURES].median()
    model = make_model("gbm", seed).fit(_fill(train[FEATURES], med), train["y"])
    res = permutation_importance(model, _fill(test[FEATURES], med), test["y"], n_repeats=10, random_state=seed)
    return pd.Series(res.importances_mean, index=FEATURES).sort_values(ascending=False)


def combine_with_classical(classical: dict[str, pd.DataFrame], ml: pd.DataFrame) -> dict[str, pd.DataFrame]:
    """Join ML forecasts onto each market's classical walk-forward table (common dates only)."""
    merged = {}
    for sym, df in classical.items():
        m = ml[ml["symbol"] == sym].set_index("date")[ML_MODELS]
        merged[sym] = df.join(m, how="inner").dropna()
    return merged
