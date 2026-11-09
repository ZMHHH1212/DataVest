"""Shared chart style for the notebooks, matching the DataVest website."""
import matplotlib as mpl
from cycler import cycler

INK = "#1b2433"
INK_SOFT = "#5a6676"
RULE = "#c9d1da"
PAPER = "#f8f9fb"
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
JADE = "#0f7b6c"
CINNABAR = "#c2412d"

mpl.rcParams.update({
    "figure.figsize": (10, 4.5),
    "figure.dpi": 110,
    "savefig.dpi": 110,
    "figure.facecolor": PAPER,
    "axes.facecolor": PAPER,
    "savefig.facecolor": PAPER,
    "axes.edgecolor": RULE,
    "axes.labelcolor": INK_SOFT,
    "axes.titlecolor": INK,
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.titlelocation": "left",
    "axes.titlepad": 12,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "axes.grid.axis": "y",
    "axes.prop_cycle": cycler(color=SERIES),
    "grid.color": RULE,
    "grid.linewidth": 0.8,
    "grid.alpha": 0.7,
    "xtick.color": INK_SOFT,
    "ytick.color": INK_SOFT,
    "xtick.major.size": 0,
    "ytick.major.size": 0,
    "font.size": 11,
    "font.family": "sans-serif",
    "legend.frameon": False,
    "lines.linewidth": 1.6,
})
