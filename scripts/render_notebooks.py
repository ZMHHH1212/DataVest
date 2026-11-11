"""Render executed notebooks as DataVest-styled pages, plus an index page.

    jupyter nbconvert --to notebook --execute analysis/*.ipynb --output-dir build/notebooks
    python scripts/render_notebooks.py build/notebooks frontend/analysis

Each page gets the site's top bar, a contents list, code folded behind "Show code",
and charts/tables as produced by the notebook.
"""
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import mistune
from pygments import highlight
from pygments.formatters import HtmlFormatter
from pygments.lexers import PythonLexer

REPO = "https://github.com/ZMHHH1212/DataVest/blob/main/analysis"
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900'
         '&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&family=Noto+Sans+HK:wght@300;400;500;700&display=swap" rel="stylesheet">')
# report look (same as the rest of the site) + saved light/dark choice applied before paint
STYLE = ('<link rel="stylesheet" href="../styles.css"><link rel="stylesheet" href="../report.css">'
         '<script>try { const t = localStorage.getItem("datavest.theme"); '
         'if (t === "dark" || t === "light") document.documentElement.dataset.theme = t; } catch {}</script>')


def hero(eyebrow: str, extra: str = "") -> str:
    return (f'<div class="r-hero page-hero"><header class="top" id="top"></header><div class="stage">'
            f'<p class="kicker eyebrow mono">{eyebrow}</p><p class="mega mega-page" aria-hidden="true">Analysis</p>{extra}</div></div>')
FOOTER = ('<footer class="foot r-foot"><p class="wordmark" aria-hidden="true">DataVest</p><p>Prices from Yahoo Finance. The notebooks are re-run with fresh data every weekday.</p>'
          '<p>DataVest is a learning project. Nothing here is financial advice, and past performance does not predict future results.</p>'
          '<p class="credit">Built by ZMH</p></footer>')
PLAIN_REPR = re.compile(r"^(<|Text\(|\[<|\(<|<Figure)")

markdown = mistune.create_markdown(escape=False, plugins=["table", "strikethrough"])
formatter = HtmlFormatter(nowrap=False, cssclass="hl")


def slug(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def src(cell) -> str:
    s = cell.get("source", "")
    return "".join(s) if isinstance(s, list) else s


def render_md(text: str, toc: list | None = None) -> str:
    out = markdown(text)
    if toc is not None:
        def h2(m):
            title = m.group(1)
            anchor = slug(title)
            toc.append((anchor, re.sub(r"<[^>]+>", "", title)))
            return f'<h2 id="{anchor}">{title}</h2>'
        out = re.sub(r"<h2>(.*?)</h2>", h2, out)
    return out


def render_outputs(outputs: list, section: str) -> str:
    parts = []
    for o in outputs:
        kind = o.get("output_type")
        if kind == "stream":
            text = "".join(o.get("text", ""))
            if text.strip():
                parts.append(f'<pre class="nb-text">{html.escape(text.rstrip())}</pre>')
        elif kind in ("display_data", "execute_result"):
            data = o.get("data", {})
            if "image/png" in data:
                png = "".join(data["image/png"]).replace("\n", "")
                parts.append(f'<figure class="nb-fig"><img src="data:image/png;base64,{png}" alt="Chart: {html.escape(section)}" loading="lazy"></figure>')
            elif "text/markdown" in data:
                parts.append(f'<div class="nb-result">{render_md("".join(data["text/markdown"]))}</div>')
            elif "text/html" in data:
                parts.append(f'<div class="nb-table">{"".join(data["text/html"])}</div>')
            elif "text/plain" in data:
                text = "".join(data["text/plain"])
                if not PLAIN_REPR.match(text.strip()):
                    parts.append(f'<pre class="nb-text">{html.escape(text)}</pre>')
        elif kind == "error":
            parts.append(f'<pre class="nb-text nb-error">{html.escape(o.get("ename", "Error"))}: {html.escape(o.get("evalue", ""))}</pre>')
    return f'<div class="nb-out">{"".join(parts)}</div>' if parts else ""


def summary_of(first_md: str) -> str:
    """Plain-text question from the intro cell, for the index page."""
    m = re.search(r"\*\*Question\.\*\*\s*(.+?)(?:\n\n|$)", first_md, flags=re.S)
    text = m.group(1) if m else first_md.split("\n\n")[1] if "\n\n" in first_md else ""
    return re.sub(r"[*_`]", "", text).strip()


def render_notebook(path: Path, out_dir: Path, run_date: str) -> dict:
    nb = json.loads(path.read_text())
    cells = nb["cells"]
    first = src(cells[0]) if cells and cells[0]["cell_type"] == "markdown" else ""
    title_match = re.match(r"#\s+(.+)", first)
    title = title_match.group(1).strip() if title_match else path.stem.replace("_", " ")
    intro = first[title_match.end():] if title_match else first

    toc: list[tuple[str, str]] = []
    body = [f'<div class="nb-md nb-intro">{render_md(intro)}</div>']
    section = title
    for cell in cells[1:]:
        text = src(cell)
        if cell["cell_type"] == "markdown":
            h = re.search(r"^##\s+(.+)$", text, flags=re.M)
            if h:
                section = h.group(1).strip()
            body.append(f'<div class="nb-md">{render_md(text, toc)}</div>')
        elif cell["cell_type"] == "code":
            code = highlight(text, PythonLexer(), formatter)
            body.append(f'<details class="nb-code"><summary>Show code</summary>{code}</details>')
            body.append(render_outputs(cell.get("outputs", []), section))

    toc_html = "".join(f'<li><a href="#{a}">{html.escape(t)}</a></li>' for a, t in toc)
    page = f"""<!doctype html>
<html lang="en" class="report">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DataVest · {html.escape(title)}</title>
<meta name="description" content="{html.escape(summary_of(first)[:180])}">
{FONTS}
{STYLE}
</head>
<body class="nb-page">
{hero('<a href="./">Analysis</a> · study')}
<div class="r-body">
<div class="nb-layout">
  <aside class="nb-toc" aria-label="Contents">
    <p class="toc-title">Contents</p>
    <ul>{toc_html}</ul>
    <div class="toc-actions">
      <button type="button" class="btn-quiet" id="toggle-code" aria-pressed="false">Show all code</button>
      <a href="{REPO}/{path.name}">View the notebook on GitHub</a>
    </div>
  </aside>
  <article class="nb" id="main">
    <p class="kicker"><a href="./">Analysis</a></p>
    <h1>{html.escape(title)}</h1>
    <p class="nb-meta">Run with the latest data on {run_date}. The code behind each result is folded away under "Show code".</p>
    {''.join(body)}
  </article>
</div>
</div>
{FOOTER}
<script type="module">
  import {{ renderTopBar }} from "../js/common.js";
  renderTopBar("analysis", "../");
  const btn = document.getElementById("toggle-code");
  btn.addEventListener("click", () => {{
    const open = btn.getAttribute("aria-pressed") !== "true";
    document.querySelectorAll(".nb-code").forEach((d) => (d.open = open));
    btn.setAttribute("aria-pressed", String(open));
    btn.textContent = open ? "Hide all code" : "Show all code";
  }});
</script>
</body>
</html>
"""
    out = out_dir / f"{path.stem}.html"
    out.write_text(page)
    return {"file": out.name, "title": title, "summary": summary_of(first), "sections": [t for _, t in toc]}


def render_index(items: list[dict], out_dir: Path, run_date: str) -> None:
    rows = "".join(f"""
      <li class="nb-item">
        <span class="nb-num">{i + 1:02d}</span>
        <div>
          <h2><a href="{it['file']}">{html.escape(it['title'])}</a></h2>
          <p>{html.escape(it['summary'])}</p>
          <p class="nb-sections">{html.escape(', '.join(re.sub(r'^\d+\.\s*', '', s) for s in it['sections']))}</p>
        </div>
      </li>""" for i, it in enumerate(items))
    page = f"""<!doctype html>
<html lang="en" class="report">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DataVest · Analysis</title>
<meta name="description" content="Data analysis behind DataVest: US vs Hong Kong markets, forecasting risk, and testing the RSI indicator.">
{FONTS}
{STYLE}
</head>
<body>
{hero('Analysis', '<h1 class="hero-h1">The research behind DataVest.</h1><p class="nb-lead">Each study asks one question about the markets and answers it with five years of daily prices. The full code is included, and every study is re-run with fresh data each weekday.</p>')}
<div class="r-body">
<main class="page nb-index frame auto" id="main">
  <ol class="nb-list">{rows}
  </ol>
  <p class="nb-meta">Last run {run_date}.</p>
</main>
</div>
{FOOTER}
<script type="module">
  import {{ renderTopBar }} from "../js/common.js";
  renderTopBar("analysis", "../");
</script>
</body>
</html>
"""
    (out_dir / "index.html").write_text(page)


def main() -> None:
    in_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    run_date = datetime.now(timezone.utc).strftime("%-d %B %Y")
    items = [render_notebook(p, out_dir, run_date) for p in sorted(in_dir.glob("*.ipynb"))]
    render_index(items, out_dir, run_date)
    print(f"Rendered {len(items)} notebooks and an index into {out_dir}")


if __name__ == "__main__":
    main()
