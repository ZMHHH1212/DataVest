// Track 1 (Money foundations) lessons for the Learn page. Each lesson's body is a function of the site's live data
// ({ insights, models, names }), so examples use real numbers; every number has a fallback.

const pct = (x, d = 1) => (x == null ? "–" : `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(d)}%`);
const vol = (x) => (x == null ? "–" : `${Math.round(x * 100)}%`);

export const FOUNDATIONS = [
  {
    id: "basics",
    title: "Money basics",
    minutes: 4,
    summary: "Where your money goes, why an emergency fund comes first, and paying yourself first.",
    body: () => `
      <p>Before investing, get three things in place. They matter more than which stock you pick.</p>
      <h3>1. Know where your money goes</h3>
      <p>Track a month of spending. Most people are surprised by the small things: drinks, food delivery, subscriptions. A budget is not a punishment. It is a plan for money that would otherwise disappear. The <a href="tools.html">50/30/20 split</a> is a simple place to start: half on needs, 30% on wants, 20% on saving.</p>
      <h3>2. Build an emergency fund</h3>
      <p>Keep about <b>3 to 6 months of essential spending</b> in a savings account you can reach quickly. It is there for losing a job, a medical bill or a broken phone. Without it, a bad month forces you to borrow at high interest, or to sell investments when prices are low.</p>
      <h3>3. Pay yourself first</h3>
      <p>Move your saving out on payday, before you spend, ideally automatically. Saving whatever is left at the end of the month usually means saving nothing.</p>
      <h3>Expensive debt comes before investing</h3>
      <p>Credit cards and many personal loans charge far more interest than investments usually earn. Paying off a card at a high interest rate is a guaranteed return of that rate. No investment can promise that.</p>`,
    takeaways: ["Track spending for a month before setting a budget.", "Emergency fund first: 3–6 months of essential spending.", "Save on payday, automatically.", "Clear high-interest debt before investing."],
    quiz: [
      { q: "What is an emergency fund for?", options: ["Buying stocks when they fall", "Unexpected costs such as losing a job or a medical bill", "Holidays and big purchases"], answer: 1, why: "It covers the unexpected so you don't have to borrow at high interest or sell investments at a bad time." },
      { q: "You have a credit card balance charging a high interest rate and some spare cash. What usually comes first?", options: ["Invest the cash in stocks", "Pay off the credit card", "Keep the cash and pay the minimum"], answer: 1, why: "Paying off high-interest debt is a guaranteed return equal to its interest rate, which investments can't promise." },
      { q: "What does \"pay yourself first\" mean?", options: ["Spend on yourself before bills", "Move money into savings on payday, before spending", "Ask for a pay rise"], answer: 1, why: "Saving first, ideally automatically, makes saving the default instead of whatever happens to be left over." },
    ],
  },
  {
    id: "compound",
    title: "Compound growth and inflation",
    minutes: 4,
    summary: "Why time matters more than amount, the rule of 72, and how inflation quietly shrinks cash.",
    body: () => `
      <p><b>Compound growth</b> means earning returns on your past returns. HK$1,000 growing 7% a year becomes HK$1,070 after a year, then HK$1,145, and after 30 years about HK$7,600. Most of that final amount is growth on growth.</p>
      <h3>The rule of 72</h3>
      <p>Divide 72 by the yearly return to estimate how many years it takes money to double. At 6%, about 12 years. At 2%, about 36 years. It also works in reverse for costs: at 3% inflation, prices double in about 24 years.</p>
      <h3>Time beats amount</h3>
      <p>Starting ten years earlier often matters more than saving twice as much later, because early money has the most years to compound. Try it in <a href="tools.html">the cost of waiting calculator</a>.</p>
      <h3>Inflation: the hidden cost of cash</h3>
      <p>If prices rise 2% a year, HK$100 kept under the mattress buys only about HK$82 of today's goods after 10 years. Cash is safe from market falls but not from inflation. That is why long-term savings usually need to grow at least as fast as prices.</p>`,
    takeaways: ["Returns on returns: growth speeds up over time.", "Rule of 72: years to double ≈ 72 ÷ yearly return.", "Starting early is the biggest advantage a student has.", "Cash loses buying power to inflation."],
    quiz: [
      { q: "Using the rule of 72, roughly how long does money take to double at 8% a year?", options: ["About 6 years", "About 9 years", "About 16 years"], answer: 1, why: "72 ÷ 8 = 9 years." },
      { q: "Prices rise 2% a year. After 10 years, what does HK$100 in cash buy?", options: ["More than today", "The same as today", "Less than today, about HK$82 worth"], answer: 2, why: "100 ÷ 1.02¹⁰ ≈ 82. Inflation shrinks what cash can buy." },
      { q: "Why does starting to save early help so much?", options: ["Early money has the most years to compound", "Banks pay young people higher interest", "Taxes are lower when you're young"], answer: 0, why: "Each extra year multiplies all the growth that came before it." },
    ],
  },
  {
    id: "risk",
    title: "Risk and diversification",
    minutes: 5,
    summary: "Volatility, worst falls, and why owning things that don't move together lowers risk.",
    body: ({ insights, names }) => {
      const s = insights?.stats || {};
      const syms = insights?.symbols || [];
      const ranked = Object.entries(s).filter(([, v]) => v.cagr != null).sort((a, b) => b[1].cagr - a[1].cagr);
      const top = ranked[0];
      const topText = top ? `<p>Real example: in DataVest's data, <b>${names[top[0]] || top[0]}</b> grew the fastest, at <b>${pct(top[1].cagr)}</b> a year over five years. Along the way it also fell <b>${pct(top[1].max_drawdown, 0)}</b> from a peak, with volatility of ${vol(top[1].volatility)}. High returns usually come with a bumpy ride.</p>` : "";
      const i = syms.indexOf("^HSI"), j = syms.indexOf("^GSPC");
      const w = i >= 0 && j >= 0 ? insights.corr_weekly[i][j] : null;
      const corrText = w != null ? `<p>The Hang Seng and the S&amp;P 500 had a weekly correlation of only <b>${w.toFixed(2)}</b> over five years, where 1 means moving in perfect step and 0 means unrelated. Holding both smooths out the ride compared with holding either alone. The <a href="insights.html">Insights</a> page shows the full picture.</p>` : "";
      return `
      <p>In finance, <b>risk</b> mostly means uncertainty: how far the result might be from what you expected. Two numbers describe it well.</p>
      <h3>Volatility: how bumpy is the ride?</h3>
      <p>Volatility measures how much prices swing, scaled to a year. A broad stock index is typically around 15–25%. A single company is often 30% or more.</p>
      <h3>Maximum drawdown: how bad did it get?</h3>
      <p>The worst fall from a peak to a low. It answers a practical question: could you have held on without selling in panic?</p>
      ${topText}
      <h3>Diversification: the closest thing to a free lunch</h3>
      <p>If you own several things that don't all fall at the same time, losses in one are partly offset by others. The less correlated they are, the bigger the benefit.</p>
      ${corrText}
      <p>Diversification lowers the risk of any single company or country, but it can't remove the risk of the whole market falling together, as in 2008 or early 2020.</p>`;
    },
    takeaways: ["Volatility = how bumpy; drawdown = how deep the worst fall was.", "Higher returns usually come with bigger falls.", "Owning things that don't move together lowers risk.", "Diversification can't remove a market-wide crash."],
    quiz: [
      { q: "A stock fell from HK$100 to HK$40 before recovering. What was its maximum drawdown?", options: ["−40%", "−60%", "−140%"], answer: 1, why: "From 100 to 40 is a fall of 60 out of 100, or −60%." },
      { q: "Which pair diversifies better?", options: ["Two assets with correlation 0.9", "Two assets with correlation 0.2", "It makes no difference"], answer: 1, why: "Low correlation means they often don't fall together, so one cushions the other." },
      { q: "What can diversification NOT protect you from?", options: ["One company going bankrupt", "A crash that hits nearly all markets at once", "A single sector having a bad year"], answer: 1, why: "When everything falls together, holding many things doesn't help much. That's market risk." },
    ],
  },
  {
    id: "predict",
    title: "Can anyone predict the market?",
    minutes: 5,
    summary: "What DataVest's own models found: risk is somewhat predictable, direction isn't.",
    body: ({ models }) => {
      const p = models?.pooled || {};
      const g = p.garch;
      const ev = models ? Object.values(models.rsi_events || {}).flatMap((rows) => rows.filter((r) => r.group !== "all days" && r.p_value != null)) : [];
      const sig = ev.filter((r) => r.p_value < 0.05).length;
      const strat = Object.values(models?.rsi_strategy || {});
      const wins = strat.filter((s) => (s.strategy.sharpe ?? -9) > (s.buy_and_hold.sharpe ?? -9)).length;
      return `
      <p>Social media is full of indicators and "signals" that promise to show when to buy and sell. DataVest tested two ideas on five years of real prices, using only data that was available at the time of each forecast.</p>
      <h3>Forecasting risk: partly possible</h3>
      <p>${g ? `A GARCH model forecast next month's volatility with <b>${pct(g.qlike_vs_last_month, 0)}</b> error compared with assuming "next month looks like last month", and it did better in ${g.beats_last_month} of ${g.markets} markets.` : "A GARCH model forecast next month's volatility better than simple rules of thumb."} Calm and stormy periods come in runs, so recent volatility tells you something about the near future.</p>
      <h3>Forecasting direction: not with RSI</h3>
      <p>The RSI indicator is said to show when a price is "oversold" and about to bounce. ${ev.length ? `Only <b>${sig} of ${ev.length}</b> tests found a difference unlikely to be luck. By chance alone you'd expect about ${Math.round(ev.length * 0.05)}. Trading on RSI had a better return for its risk than simply holding in ${wins} of ${strat.length} markets.` : "In DataVest's tests, its signals were no better than chance."} See <a href="models.html">the Models page</a> for details.</p>
      <h3>Why direction is so hard</h3>
      <p>Prices already reflect what millions of investors know. Any easy, reliable pattern tends to be traded away once people notice it. What is left is mostly noise, plus a long-run upward drift that rewards patience rather than timing.</p>
      <h3>Beware of these traps</h3>
      <p><b>Survivorship bias:</b> you hear about the winners, not the many who lost. <b>Data snooping:</b> try enough rules on past data and one will look brilliant by luck. <b>Hindsight:</b> charts always look obvious afterwards.</p>`;
    },
    takeaways: ["Risk (volatility) is somewhat forecastable; direction mostly isn't.", "DataVest found RSI signals no better than chance.", "Easy patterns get traded away.", "Watch for survivorship bias, data snooping and hindsight."],
    quiz: [
      { q: "What did DataVest's models forecast better than simple rules?", options: ["Which way prices go next month", "How bumpy next month is likely to be", "Which stock will rise most"], answer: 1, why: "Volatility clusters, so recent turbulence helps forecast near-term risk. Direction showed no reliable signal." },
      { q: "Someone tried 200 trading rules on past data and shows you the best one. Why be careful?", options: ["With 200 tries, one will look great by luck alone", "Past data is always wrong", "Trading rules are illegal"], answer: 0, why: "That's data snooping. The best of many random tries looks impressive but usually fails on new data." },
      { q: "You mostly hear success stories about people who got rich from one stock. This is an example of…", options: ["Diversification", "Survivorship bias", "Compound growth"], answer: 1, why: "The many people who lost money don't post about it, so the winners look typical." },
    ],
  },
];
