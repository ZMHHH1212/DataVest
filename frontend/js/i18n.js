// Language support: English and Traditional Chinese (Hong Kong style, keeping common English finance terms).
// Choose with the 中/EN button or a link with ?lang=zh / ?lang=en. The choice is remembered in this browser.

const KEY = "datavest.lang";

function detect() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "zh" || q === "en") {
    try { localStorage.setItem(KEY, q); } catch { /* storage blocked */ }
    return q;
  }
  try { return localStorage.getItem(KEY) === "zh" ? "zh" : "en"; } catch { return "en"; }
}

export const LANG = detect();
export const isZh = LANG === "zh";
document.documentElement.lang = isZh ? "zh-HK" : "en";

/** Switch language by reloading with ?lang=…, so the address can be shared. */
export function switchLang() {
  const url = new URL(location.href);
  url.searchParams.set("lang", isZh ? "en" : "zh");
  location.href = url.toString();
}

// ---- strings ---------------------------------------------------------------------------
// English lives in the code and HTML; only Chinese needs a table. {name} placeholders are filled in by t().
const ZH = {
  // navigation and shared
  "nav.markets": "市場", "nav.insights": "洞察", "nav.models": "模型", "nav.portfolio": "投資組合",
  "nav.learn": "學習", "nav.tools": "工具", "nav.analysis": "研究", "nav.signin": "登入", "nav.signout": "登出",
  "lang.button": "EN", "lang.label": "Switch to English",

  // markets page: static
  "m.watchlist": "Watchlist",
  "m.orbHint": "拖動可旋轉",
  "m.orbTitle": "看清市場的<br>真實走勢",
  "m.orbSub": "增長、起落和最大跌幅（Max drawdown），用淺白的語言解釋。",
  "m.orbDesk": "打開 Dashboard", "m.orbLearn": "開始學習",
  "m.close": "收市 {date}",
  "m.addWatch": "加入 Watchlist", "m.inWatch": "已在 Watchlist",
  "m.sma50": "50 天線", "m.sma200": "200 天線",
  "m.maHelp": "甚麼是移動平均線（moving average）？",
  "m.maHelpBody": "移動平均線是過去 50 或 200 個交易日收市價的平均值，用來過濾每日的雜訊，令趨勢更清楚。價格高於 200 天線時，市場通常被形容為處於升勢。50 天線與 200 天線交叉只是描述已發生的走勢，並不是預測。",
  "m.ddTitle": "從高位回落（Drawdown）",
  "m.ddNote": "價格較之前高位低了多少。0 代表創新高。",
  "m.rsiTitle": "動能 Momentum（RSI 14）",
  "m.rsiHelp": "RSI 怎樣使用？",
  "m.rsiHelpBody": "高於 70 通常被稱為「超買」（overbought），低於 30 為「超賣」（oversold）。這些只是經驗法則：DataVest 在 Models 頁的測試發現，RSI 訊號並不比隨機好。",
  "m.risk": "風險 Dashboard",
  "m.phase": "市況（Regime）",
  "m.vol": "波幅 Volatility",
  "m.volHelp": "甚麼是波幅？",
  "m.volHelpBody": "價格上落的幅度，按年計算。一般大市指數約 15–20%；單一股票往往 30% 或以上。",
  "m.worst": "最大跌幅（Max drawdown）",
  "m.ddHelp": "甚麼是 drawdown？",
  "m.ddHelpBody": "由高位跌到其後低位的幅度。最大跌幅回答一個實際問題：如果在最差時機買入，賬面最多會蝕多少？",
  "m.cagr": "年均增長（CAGR）",
  "m.cagrHelp": "為甚麼要計「每年」？",
  "m.cagrHelpBody": "複合年增長率（CAGR）是把起點變成終點的穩定年增長率。它隱藏了中間的起伏，所以要配合波幅和最大跌幅一起看。",
  "m.var": "一個壞交易日（95% VaR）",
  "m.varHelp": "甚麼是 Value at Risk？",
  "m.varHelpBody": "每 20 個交易日只有 1 日跌得比它更多的單日跌幅。Expected shortfall 則是那些最差日子的平均跌幅。",
  "m.sfTitle": "波幅地形圖 Volatility landscape（3D）",
  "m.sfSpin": "自動旋轉", "m.sfReset": "重設視角", "m.sfIn": "放大", "m.sfOut": "縮小",
  "m.calm": "平穩", "m.stormy": "動盪",
  "m.footer1": "價格來自 Yahoo Finance，每個工作日更新。回報以已調整價格計算，已包括股息。",
  "m.credit": "由 ZMH 製作",
  "m.footer2": "DataVest 是一個學習項目，所有內容均不構成投資建議，過往表現亦不代表將來表現。",

  // markets page: dynamic
  "m.ago.1M": "一個月前", "m.ago.6M": "六個月前", "m.ago.1Y": "一年前", "m.ago.5Y": "五年前",
  "m.range.1M": "過去一個月", "m.range.6M": "過去六個月", "m.range.1Y": "過去一年", "m.range.5Y": "過去五年",
  "m.story": "{ago}投資 $100，現在值 {amount}。",
  "m.priceLine": "最新收市價 <strong>{price}</strong>（{date}），當日 {chg}。",
  "m.pts": "點",
  "m.volFigure": "每年 ±{v}%",
  "m.volCalm0": "比一般股票指數平穩", "m.volCalm1": "與一般股票指數相若",
  "m.volCalm2": "比大市指數波動，屬單一股票常見水平", "m.volCalm3": "非常波動，預期會有大起大落",
  "m.volText": "這段期間的波幅{calm}。",
  "m.forecast": "下個月預測：<b>每年 ±{v}%</b>（GARCH model）。<a href=\"models.html\">預測準確度如何？</a>",
  "m.noFall": "沒有下跌",
  "m.ddText": "由 {peak} 的高位跌至 {trough} 的低位。在高位投資的 $100 變成 ${x}。",
  "m.onlyUp": "這段期間價格只升不跌。",
  "m.cagrFigure": "每年 {v}",
  "m.cagrTotal": "這段期間的總變幅。選擇 1 年或以上可看到年率。",
  "m.cagrText": "相當於 {years} 年內總變幅 {total} 的穩定年增長率。",
  "m.varFigure": "單日 {v}",
  "m.varText": "每 20 個交易日約有 1 日跌幅達此水平或以上；這些日子的平均跌幅為 {es}。",
  "m.varShort": "請選擇 6 個月或以上：需要最少 20 個交易日。",
  "m.rsiNone": "比較近期升幅與跌幅的大小，數值由 0 至 100。",
  "m.rsiNote": "最新讀數 {n}：{zone}。",
  "m.rsiHigh": "高於 70，即常說的 overbought（超買）區",
  "m.rsiLow": "低於 30，即常說的 oversold（超賣）區",
  "m.rsiMid": "介乎 30 至 70，屬中性區",
  "m.regimeText": "Hidden Markov Model 估計的機率為 {p}%。平穩期每年波幅約 ±{c}%，動盪期約 ±{s}%。",
  "m.newHigh": "創新高",
  "m.belowHigh": "較之前高位 {x}",
  "m.avgLabel": "{label}平均線：{price}",
  "m.sfNote": "每條山脊代表一個市場過去五年的 3 個月波幅：山峰即動盪時期。最高峰是 {label}，約在 {date}（每年 ±{v}%）。拖動可旋轉，把滑鼠移到圖上可查看數值。",
  "m.sfWeek": "{date} 該週",
  "m.sfTip": "{label}<br>{date}<br>波幅 <b>{v}%</b>",
  "m.updated": "最後更新：{when}。",
  "m.chartLabel": "{name} 由 {start} 至 {end} 的價格，總變幅 {total}。",
  "m.groups.Your watchlist": "我的 Watchlist",
  "m.groups.Indexes": "指數", "m.groups.Index funds": "指數基金（ETF）",
  "m.groups.US stocks": "美股", "m.groups.Hong Kong stocks": "港股",
};

/** Translate a key (Chinese only); fall back to the English text given. */
export function t(key, en, vars = {}) {
  const s = isZh && ZH[key] != null ? ZH[key] : en;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
}

/** Replace the text of every element marked data-i18n="key" (keeps the English in the HTML). */
export function applyStatic(root = document) {
  if (!isZh) return;
  root.querySelectorAll("[data-i18n]").forEach((el) => {
    const s = ZH[el.dataset.i18n];
    if (s != null) el.innerHTML = s;
  });
  root.querySelectorAll("[data-i18n-label]").forEach((el) => {
    const s = ZH[el.dataset.i18nLabel];
    if (s != null) el.setAttribute("aria-label", s);
  });
}

// ---- names and dates -------------------------------------------------------------------
const NAMES_ZH = {
  "^GSPC": "S&P 500 標普500", "^IXIC": "Nasdaq 納斯達克", "^HSI": "恒生指數",
  SPY: "SPY（S&P 500 ETF）", "2800.HK": "盈富基金（2800）",
  AAPL: "Apple 蘋果", MSFT: "Microsoft 微軟", NVDA: "Nvidia 英偉達", "0700.HK": "騰訊", "0005.HK": "滙豐",
};
const SHORT_ZH = {
  "^GSPC": "標普500", "^IXIC": "納指", "^HSI": "恒指", SPY: "SPY", "2800.HK": "盈富 2800",
  AAPL: "Apple", MSFT: "Microsoft", NVDA: "Nvidia", "0700.HK": "騰訊", "0005.HK": "滙豐",
};
export const marketName = (sym, en) => (isZh && NAMES_ZH[sym]) || en;
export const marketShort = (sym, en) => (isZh && SHORT_ZH[sym]) || en;

/** Dates: "9 Nov 2026" in English, "2026年11月9日" in Chinese. */
export function dateText(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isZh) return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
