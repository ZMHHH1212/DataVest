// Track 2 (Stock investing) lessons. Bodies may contain <div class="widget" data-widget="..."> slots,
// which widgets.js fills with interactive tools after the lesson renders.

const W = (name) => `<div class="widget" data-widget="${name}"><p class="muted">Loading…</p></div>`;

export const INVESTING = [
  // 1 ------------------------------------------------------------------------------------------
  {
    id: "returns-risk",
    title: "Returns and risk",
    minutes: 6,
    summary: "How to measure what an investment earned, compare different time periods, and understand the kinds of risk you take.",
    body: () => `
      <p>People invest to make their money grow faster than prices rise, and to reach goals such as a home, further study or retirement. To judge any investment you need two things: a way to measure what it earned, and a way to think about what could go wrong.</p>
      <h3>Measuring a return</h3>
      <p>The <b>holding-period return</b> is everything you gained over the time you held something, relative to what you paid:</p>
      <p class="formula">Return = (selling price − buying price + income received) ÷ buying price</p>
      <p>Buy a share at HK$50, collect a HK$2 dividend, sell at HK$55: (55 − 50 + 2) ÷ 50 = <b>14%</b>. Forgetting the dividend would understate the return at 10%.</p>
      <h3>Comparing different time periods</h3>
      <p>14% over one year and 14% over five years are very different results. To compare them, convert each to a yearly <b>annualised</b> return:</p>
      <p class="formula">Annualised return = (1 + total return)<sup>1/years</sup> − 1</p>
      <p>A 21% gain over two years is 10% a year, not 10.5%, because the second year grows on top of the first.</p>
      <p>Interest rates have a similar trap. A loan or deposit quoted at 12% a year but compounded monthly actually works out to about <b>12.68%</b> a year, its <b>effective annual rate</b>. Always compare effective rates.</p>
      <h3>Return of a portfolio</h3>
      <p>A portfolio's return is the weighted average of its holdings. With 60% in a fund that rose 10% and 40% in one that fell 5%: 0.6 × 10% + 0.4 × (−5%) = <b>4%</b>.</p>
      ${W("returns")}
      <h3>What "risk" means</h3>
      <p>Risk is the chance that the result is worse than you expected. It comes in several kinds:</p>
      <ul>
        <li><b>Market risk:</b> the whole market falls, and almost everything falls with it. Diversification can't remove it.</li>
        <li><b>Interest-rate risk:</b> rising rates lower the value of bonds and often of shares.</li>
        <li><b>Credit risk:</b> a borrower, such as a bond issuer, fails to pay you back.</li>
        <li><b>Liquidity risk:</b> you can't sell quickly without accepting a much lower price.</li>
        <li><b>Reinvestment risk:</b> money that comes back to you can only be reinvested at a lower rate.</li>
        <li><b>Currency risk:</b> an investment priced in another currency loses value when that currency weakens.</li>
        <li><b>Political and regulatory risk:</b> new laws, taxes or political events change the rules.</li>
      </ul>
      <h3>Your risk tolerance</h3>
      <p>Risk tolerance is how much ups and downs you can accept, both financially and emotionally. It depends on how long until you need the money, how stable your income is, and how you'd react to seeing your savings fall by a third. A long time horizon usually allows more short-term risk, because there is time to recover from falls.</p>
      ${W("risk-check")}`,
    takeaways: ["Count income (dividends) as well as price change.", "Annualise returns before comparing different periods.", "Compare interest rates by their effective annual rate.", "Know the main kinds of risk, and your own tolerance for them."],
    quiz: [
      { q: "You buy at HK$20, receive HK$1 in dividends and sell at HK$22. What is your holding-period return?", options: ["10%", "15%", "5%"], answer: 1, why: "(22 − 20 + 1) ÷ 20 = 3 ÷ 20 = 15%." },
      { q: "An investment gains 21% over two years. Its annualised return is…", options: ["10.5%", "10%", "21%"], answer: 1, why: "1.10 × 1.10 = 1.21, so 10% a year compounds to 21%." },
      { q: "Which kind of risk can diversification NOT remove?", options: ["Credit risk of one company", "Market risk", "Liquidity risk of one small stock"], answer: 1, why: "Market (systematic) risk affects almost everything at once." },
      { q: "Who can usually accept more short-term risk?", options: ["Someone needing the money in 6 months", "Someone investing for 30 years", "Both the same"], answer: 1, why: "A long horizon leaves time to recover from falls." },
    ],
  },
  // 2 ------------------------------------------------------------------------------------------
  {
    id: "stock-market",
    title: "How the stock market works",
    minutes: 6,
    summary: "What owning a share gives you, ordinary vs preference shares, and how shares are issued and traded.",
    body: () => `
      <h3>A share is part-ownership of a company</h3>
      <p>Owning shares makes you a part-owner. As a shareholder of ordinary shares you usually have the right to:</p>
      <ul>
        <li><b>vote</b> at shareholder meetings, for example on directors and major decisions</li>
        <li><b>receive dividends</b> when the board declares them</li>
        <li><b>receive financial reports</b> and other information the company must publish</li>
        <li><b>a share of what's left</b> if the company is wound up, but only after lenders and other creditors are paid</li>
        <li>in many cases, <b>buy new shares first</b> in proportion to your holding before outsiders can (pre-emptive rights)</li>
      </ul>
      <h3>Ordinary vs preference shares</h3>
      <table>
        <tr><th></th><th>Ordinary (common) shares</th><th>Preference shares</th></tr>
        <tr><td>Dividend</td><td>Varies; can be cut to zero</td><td>Usually fixed, paid before ordinary dividends</td></tr>
        <tr><td>Voting</td><td>Usually yes</td><td>Usually no</td></tr>
        <tr><td>If wound up</td><td>Paid last</td><td>Paid before ordinary shareholders</td></tr>
        <tr><td>Upside</td><td>Unlimited if the company grows</td><td>Limited, behaves more like a bond</td></tr>
      </table>
      <h3>Why invest in shares at all?</h3>
      <p>Over long periods, shares have historically grown faster than cash and bonds, because owners share in company profits and growth. The price for that is volatility: shares can fall a lot, sometimes for years. The <a href="./">Markets</a> page shows real worst falls.</p>
      <h3>Primary and secondary markets</h3>
      <p>In the <b>primary market</b> a company sells new shares to raise money, for example through an initial public offering (IPO). This is the only time the company itself receives the money. Afterwards, investors trade those shares with each other in the <b>secondary market</b>, the stock exchange. Hong Kong's exchange is run by HKEX, with a Main Board for established companies and GEM for smaller ones.</p>
      <h3>Trading in Hong Kong: the basics</h3>
      <ul>
        <li><b>Trading hours</b> (weekdays): a pre-opening session from 9:00, continuous trading 9:30–12:00 and 13:00–16:00, then a short closing auction.</li>
        <li><b>Board lots:</b> shares normally trade in fixed lot sizes set by each company, such as 100 or 500 shares. Smaller "odd lots" are harder to trade.</li>
        <li><b>Settlement:</b> shares and money change hands two trading days after the trade (T+2).</li>
      </ul>
      <h3>Choosing a broker</h3>
      <p>You trade through a broker. <b>Full-service brokers</b> (often banks) offer research, advice and phone dealing, at higher fees. <b>Discount or online brokers</b> mainly just execute your trades, cheaply through an app. Accounts come in two types. In a <b>cash account</b> you pay in full. In a <b>margin account</b> the broker lends you part of the money against your shares. That magnifies both gains and losses, and if prices fall you can face a <b>margin call</b>: add money or be sold out at a bad time.</p>`,
    takeaways: ["Ordinary shareholders vote, may get dividends, and are paid last.", "Preference shares: steadier dividend, usually no vote, limited upside.", "Companies raise money in the primary market; investors trade in the secondary.", "Margin borrowing magnifies gains and losses."],
    quiz: [
      { q: "When does a company receive money from its shares being bought?", options: ["Every time its shares trade", "When it issues new shares, e.g. in an IPO", "Never"], answer: 1, why: "Secondary-market trades are between investors. The company only raises money when it issues shares." },
      { q: "If a company is wound up, who is paid last?", options: ["Lenders", "Preference shareholders", "Ordinary shareholders"], answer: 2, why: "Ordinary shareholders have the residual claim: whatever is left after everyone else." },
      { q: "Which is typical of preference shares?", options: ["Fixed dividend paid before ordinary dividends", "Extra votes", "Unlimited growth"], answer: 0, why: "They trade voting rights and upside for a steadier, prioritised dividend." },
      { q: "What is the main danger of a margin account?", options: ["Higher stamp duty", "Losses are magnified and you may be forced to sell at a low price", "You can't receive dividends"], answer: 1, why: "Borrowed money enlarges positions, and a margin call can force a sale when prices are down." },
    ],
  },
  // 3 ------------------------------------------------------------------------------------------
  {
    id: "placing-trade",
    title: "Placing a trade in Hong Kong",
    minutes: 6,
    summary: "Reading a quote, the main order types and how long they last, and what a trade really costs.",
    body: () => `
      <h3>From order to settlement</h3>
      <p>You open an account with a broker, place an order in their app or by phone, and the exchange's system matches it with an opposite order. Two trading days later the trade settles: the money and shares move through the clearing house.</p>
      <h3>Reading a price quote</h3>
      <ul>
        <li><b>Last price</b> and <b>change</b>: the latest trade, and how it compares with yesterday's close.</li>
        <li><b>Bid</b>: the highest price buyers are offering. <b>Ask</b> (or offer): the lowest price sellers will accept. The gap is the <b>spread</b>. It is narrow for busy stocks and wide for quiet ones.</li>
        <li><b>Volume</b> and <b>turnover</b>: how many shares, and how much money, traded today.</li>
        <li><b>Day range</b> and <b>52-week range</b>: the lowest and highest prices over the day and the year.</li>
        <li>Often also the <b>P/E ratio</b> and <b>dividend yield</b>, both covered in the valuation lesson.</li>
      </ul>
      <h3>Order types</h3>
      <ul>
        <li><b>Market order:</b> buy or sell now at the best available price. It's fast, but you don't control the price. A large order can "walk up" through several price levels.</li>
        <li><b>Limit order:</b> buy at no more than, or sell at no less than, your chosen price. You control the price, but it may never fill.</li>
        <li><b>Stop (stop-loss) order:</b> becomes an order to sell (or buy) once the price reaches a trigger level. It's used to limit losses. In a fast fall it may fill well below the trigger.</li>
        <li><b>Stop-limit order:</b> once triggered, becomes a limit order. It protects the price but may not fill.</li>
      </ul>
      <h3>How long an order stays active</h3>
      <ul>
        <li><b>Day order:</b> cancelled at the end of the day if not filled. This is the default at many Hong Kong brokers.</li>
        <li><b>Good-till-cancelled (GTC):</b> stays until filled or you cancel it, though brokers often set a maximum period.</li>
        <li><b>Good-till-date (GTD):</b> stays until a date you choose.</li>
        <li><b>At-auction (opening or closing):</b> only trades in the opening or closing auction.</li>
      </ul>
      <h3>What a trade really costs</h3>
      <p>Besides the broker's commission, each side of a Hong Kong share trade (buying and selling) carries stamp duty of 0.1%, rounded up to the next dollar, plus small exchange and regulator fees. Brokers may also charge settlement, custody or dividend-collection fees. Costs are charged on both the buy and the sell, so the price must rise just to break even. Try it:</p>
      ${W("trade-cost")}
      <p>The lesson: frequent small trades lose a noticeable share to costs, and minimum commissions hit small orders hardest.</p>`,
    takeaways: ["Bid is what buyers offer, ask is what sellers want; the gap is the spread.", "Market orders control speed; limit orders control price.", "Stop orders limit losses but can fill below the trigger in a fast market.", "Costs apply to both buying and selling, so you need a rise just to break even."],
    quiz: [
      { q: "You want to buy, but only if the price is HK$48 or less. Which order?", options: ["Market order", "Limit order at HK$48", "Stop order at HK$48"], answer: 1, why: "A limit buy order never pays more than your limit." },
      { q: "The bid is HK$9.98 and the ask is HK$10.00. If you place a market order to buy, you'll most likely pay…", options: ["HK$9.98", "HK$10.00", "HK$9.99"], answer: 1, why: "Buyers pay the ask, the lowest price a seller currently accepts." },
      { q: "A day order that isn't filled…", options: ["Stays open until filled", "Is cancelled at the end of the trading day", "Becomes a market order"], answer: 1, why: "Day orders expire at the close." },
      { q: "Why must a share rise before a round trip (buy then sell) makes money?", options: ["Because of costs on both sides", "Because of dividends", "It doesn't need to"], answer: 0, why: "Commission, stamp duty and fees are paid on the buy and again on the sell." },
    ],
  },
  // 4 ------------------------------------------------------------------------------------------
  {
    id: "price-drivers",
    title: "What moves stock prices",
    minutes: 6,
    summary: "Company fundamentals, the economy, trading conditions and investor mood, with real bull and bear markets.",
    body: () => `
      <p>In the long run, a share is worth the cash it will pay its owners in the future, valued in today's money. Anything that changes the expected size, timing or riskiness of that cash moves the price. In the short run, mood and trading conditions matter too.</p>
      <h3>1. Fundamentals: earnings, dividends, growth and the discount rate</h3>
      <ul>
        <li><b>Earnings:</b> profit is the source of all future dividends. Results that beat or miss expectations often move prices sharply, because what matters is the surprise.</li>
        <li><b>Dividends vs growth:</b> a company can pay profits out now or reinvest them. Reinvesting is worth it only if the company earns a good return on the money it keeps.</li>
        <li><b>Growth:</b> faster expected growth in earnings raises today's value.</li>
        <li><b>Discount rate:</b> the return investors demand, made up of interest rates plus a premium for risk. When interest rates rise, future cash is worth less today, so prices tend to fall. Fast-growing companies, whose cash lies far in the future, are hit hardest.</li>
      </ul>
      <h3>2. External factors</h3>
      <ul>
        <li><b>The economy:</b> growth, unemployment, inflation, interest rates, exchange rates and government policy. Hong Kong's market is also strongly affected by mainland China's economy and by US interest rates, because the Hong Kong dollar is pegged to the US dollar.</li>
        <li><b>Trend:</b> prices often move in trends for a while. Short-term trends are noisy. Long-term trends follow earnings and the economy.</li>
        <li><b>Liquidity:</b> heavily traded stocks have narrow spreads and steady prices. Thinly traded stocks can jump on small orders.</li>
      </ul>
      <h3>3. Market sentiment: bulls and bears</h3>
      <p>Investor mood swings between optimism and fear, often further than the fundamentals justify. A <b>bull market</b> is a sustained rise. A <b>bear market</b> is usually defined as a fall of 20% or more from a peak. Here are the real ones in DataVest's five years of data:</p>
      ${W("bear-markets")}
      <p>Notice that bear markets end, but recoveries can take a long time, and they differ a lot between markets.</p>`,
    takeaways: ["A share's value is today's worth of its future cash to owners.", "Higher interest rates usually push prices down.", "The economy, trends and liquidity move prices in the short run.", "Bear market: a fall of 20% or more from a peak."],
    quiz: [
      { q: "Interest rates rise sharply. All else equal, share prices tend to…", options: ["Rise", "Fall", "Stay the same"], answer: 1, why: "A higher discount rate makes future cash worth less today." },
      { q: "A company reports profit up 10%, but investors expected 25%. The price will most likely…", options: ["Rise, because profit grew", "Fall, because it missed expectations", "Not change"], answer: 1, why: "Prices react to surprises versus expectations, not to growth alone." },
      { q: "A bear market is commonly defined as…", options: ["Any down day", "A fall of 20% or more from a peak", "A fall of 5%"], answer: 1, why: "20% from a peak is the usual rule of thumb." },
      { q: "Why can a thinly traded stock jump sharply on a small order?", options: ["Low liquidity", "High dividend", "It's in an index"], answer: 0, why: "With few buyers and sellers, small orders can move the price a lot." },
    ],
  },
  // 5 ------------------------------------------------------------------------------------------
  {
    id: "accounts",
    title: "Reading company accounts",
    minutes: 7,
    summary: "The balance sheet, income statement and cash flow statement, and what each tells an investor.",
    body: () => `
      <p>Company accounts are where a business reports what it owns, what it owes, what it earned and where its cash went. Three statements do most of the work.</p>
      <h3>The accounting equation</h3>
      <p class="formula">Assets = Liabilities + Equity</p>
      <p>Everything a company owns (<b>assets</b>) was paid for either with borrowed money (<b>liabilities</b>) or with the owners' money (<b>equity</b>: money shareholders put in plus profits kept over the years). Every transaction changes both sides equally, so the two sides always balance. Try it:</p>
      ${W("balance-sheet")}
      <h3>1. The balance sheet: a snapshot on one day</h3>
      <ul>
        <li><b>Current assets</b> turn into cash within a year: cash, money customers owe (receivables), inventory.</li>
        <li><b>Non-current assets</b> are long-term: property, machinery, patents, investments.</li>
        <li><b>Current liabilities</b> are due within a year: supplier bills, short-term loans. <b>Non-current liabilities</b> are long-term debt.</li>
        <li><b>Equity</b> is what is left for shareholders: assets minus liabilities.</li>
      </ul>
      <p><b>Net working capital</b> = current assets − current liabilities. If it's positive, short-term bills are covered, which is a sign of liquidity. The <b>current ratio</b> divides the two. Above 1 means more current assets than current liabilities.</p>
      <h3>2. The income statement: performance over a period</h3>
      <p class="formula">Revenue − cost of sales = gross profit − operating expenses = operating profit − interest − tax = net profit</p>
      <p>Net profit divided by the number of shares gives <b>earnings per share (EPS)</b>, the "E" in the P/E ratio.</p>
      <h3>3. The cash flow statement: where the cash actually went</h3>
      <p>Profit is not the same as cash. A sale on credit counts as revenue before the cash arrives, and depreciation reduces profit without any cash leaving. Cash flows are split into <b>operating</b> (running the business), <b>investing</b> (buying or selling long-term assets) and <b>financing</b> (borrowing, repaying, issuing shares, paying dividends).</p>
      <p class="formula">Free cash flow = cash from operations − capital spending</p>
      <p>Free cash flow is the cash a company could pay its owners without harming the business. Many investors trust it more than reported profit.</p>
      <h3>Book value vs market value</h3>
      <p><b>Book value</b> is equity as recorded in the accounts. <b>Market value</b> is share price × number of shares. They often differ a lot. Accounts record many assets at historical cost and miss intangibles such as brands, while the market prices in expected future profits. The ratio of the two is the price-to-book (P/B) ratio.</p>`,
    takeaways: ["Assets = liabilities + equity, always.", "Balance sheet = a moment; income statement = a period.", "Profit isn't cash: check free cash flow.", "Market value often differs greatly from book value."],
    quiz: [
      { q: "A company borrows HK$1m from a bank and keeps it as cash. What happens?", options: ["Assets +1m, liabilities +1m", "Assets +1m, equity +1m", "Nothing changes"], answer: 0, why: "Cash (an asset) rises, and so does the loan it owes (a liability)." },
      { q: "Which statement shows performance over a period, like a year?", options: ["Balance sheet", "Income statement", "Neither"], answer: 1, why: "The balance sheet is a snapshot on one date; the income statement covers a period." },
      { q: "Free cash flow is…", options: ["Revenue minus tax", "Cash from operations minus capital spending", "Equity minus debt"], answer: 1, why: "It's the cash left after keeping the business running and growing." },
      { q: "Current assets HK$5m, current liabilities HK$4m. Net working capital is…", options: ["HK$9m", "HK$1m", "−HK$1m"], answer: 1, why: "5 − 4 = HK$1m, so short-term obligations are covered." },
    ],
  },
  // 6 ------------------------------------------------------------------------------------------
  {
    id: "time-value",
    title: "The time value of money",
    minutes: 6,
    summary: "Why HK$100 today is worth more than HK$100 next year, and how to value any stream of future cash.",
    body: () => `
      <p>Money today is worth more than the same money later, because today's money can be invested. What you give up by not investing it is the <b>opportunity cost</b>. Two operations translate money across time: <b>compounding</b> (today → future) and <b>discounting</b> (future → today).</p>
      <h3>Single sums</h3>
      <p class="formula">Future value = PV × (1 + r)<sup>n</sup> &nbsp;&nbsp;&nbsp; Present value = FV ÷ (1 + r)<sup>n</sup></p>
      <p>HK$10,000 at 5% for 10 years grows to about HK$16,289. Turned around, HK$16,289 promised in 10 years is worth HK$10,000 today if you could earn 5% elsewhere.</p>
      <h3>Annuities: a fixed payment every period</h3>
      <p>Monthly savings, loan repayments and pension payouts are all annuities. Their value is just the sum of each payment's future or present value, and there are shortcut formulas for that. If payments come at the start of each period (an <b>annuity due</b>), each one has one extra period to grow.</p>
      <h3>Perpetuities: payments forever</h3>
      <p class="formula">Present value of a perpetuity = payment ÷ r</p>
      <p>A payment of HK$5 a year forever, at a 4% rate, is worth 5 ÷ 0.04 = HK$125 today. Payments far in the future are worth very little now, which is why "forever" still has a finite value. If the payment <b>grows</b> at rate g each year, the value is next payment ÷ (r − g), which only works when r is bigger than g. That formula is the heart of the Gordon growth model in the next lesson.</p>
      ${W("tvm")}`,
    takeaways: ["Compounding moves money forward in time; discounting moves it back.", "An annuity is a series of equal payments.", "Perpetuity value = payment ÷ r.", "Growing perpetuity = next payment ÷ (r − g), only when r > g."],
    quiz: [
      { q: "At 10% a year, what is HK$1,100 received in one year worth today?", options: ["HK$1,100", "HK$1,000", "HK$990"], answer: 1, why: "1,100 ÷ 1.10 = 1,000." },
      { q: "A perpetuity pays HK$6 a year and the rate is 3%. Its value is…", options: ["HK$18", "HK$200", "HK$600"], answer: 1, why: "6 ÷ 0.03 = 200." },
      { q: "Why does an annuity due (payments at the start) have a higher future value?", options: ["Payments are larger", "Each payment has one extra period to grow", "Lower tax"], answer: 1, why: "Paying earlier gives every payment one more period of compounding." },
      { q: "The growing perpetuity formula next ÷ (r − g) only works when…", options: ["g > r", "r > g", "r = g"], answer: 1, why: "If growth were at least the discount rate, the value would be infinite: the formula breaks down." },
    ],
  },
  // 7 ------------------------------------------------------------------------------------------
  {
    id: "valuation",
    title: "Valuing a stock",
    minutes: 8,
    summary: "Intrinsic value, dividend discount models, free cash flow, and price multiples such as P/E.",
    body: () => `
      <h3>Intrinsic value vs market price</h3>
      <p>A share's <b>market price</b> is what it trades for today. Its <b>intrinsic value</b> is an estimate of what it is really worth, based on the cash it will produce. If your estimate is well above the price, the share may be undervalued. Estimates are uncertain, though, so careful investors want a <b>margin of safety</b>: a big enough gap that being somewhat wrong doesn't hurt much.</p>
      <h3>Approach 1: present value models</h3>
      <p><b>Dividend discount model (DDM).</b> The value of a share is the present value of all its future dividends.</p>
      <ul>
        <li><b>Preference shares</b> with a fixed dividend forever are a perpetuity: value = dividend ÷ r.</li>
        <li><b>Gordon growth model:</b> if dividends grow at a steady rate g forever, value = next year's dividend ÷ (r − g). It suits mature, stable dividend payers such as utilities. The long-run g must be modest: no company can outgrow the whole economy forever.</li>
        <li><b>Two-stage (or multi-stage) models:</b> fast growth for some years, then steady growth. These suit companies that are still growing quickly.</li>
      </ul>
      <p><b>Free cash flow to equity (FCFE).</b> Many companies pay small or no dividends. FCFE values the cash that <i>could</i> be paid to shareholders after running costs, investment and debt repayments, discounted in the same way.</p>
      <p>Small changes in r or g change the answer a lot. Try it:</p>
      ${W("gordon")}
      <h3>Approach 2: price multiples</h3>
      <ul>
        <li><b>P/E</b> = price ÷ earnings per share: how many dollars you pay for each dollar of yearly profit.</li>
        <li><b>P/B</b> = price ÷ book value per share. It is useful for banks and asset-heavy firms.</li>
        <li><b>P/S</b> = price ÷ sales per share. It works even when profits are negative.</li>
        <li><b>Dividend yield</b> = dividend per share ÷ price.</li>
      </ul>
      <p><b>The method of comparables</b> values a company by applying the multiples of similar companies. If peers trade at 12 times earnings and this company earns HK$2 a share, a comparable value is about HK$24. It's quick, but watch for the pitfalls. Peers may differ in growth, risk, debt or accounting. A low P/E can mean "cheap" or "in trouble". And if the whole sector is overpriced, comparables say nothing about that.</p>
      <h3>Which to use?</h3>
      <p>Present value models force you to state your assumptions, but they are very sensitive to them. Multiples are simple and reflect the market's current view, but they only tell you whether something is cheap <i>relative</i> to peers. Analysts usually use both and check they roughly agree.</p>`,
    takeaways: ["Intrinsic value is an estimate; insist on a margin of safety.", "Gordon model: next dividend ÷ (r − g), for steady payers.", "Valuations are very sensitive to r and g.", "Multiples compare; they don't prove a stock is cheap."],
    quiz: [
      { q: "A stock just paid a HK$2 dividend, growing 3% a year forever. Investors require 8%. Gordon value?", options: ["HK$25.00", "HK$41.20", "HK$40.00"], answer: 1, why: "Next dividend = 2 × 1.03 = 2.06; 2.06 ÷ (0.08 − 0.03) = HK$41.20." },
      { q: "Which model suits a fast-growing company that will slow down later?", options: ["Preference share perpetuity", "Two-stage dividend discount model", "Gordon with a high g forever"], answer: 1, why: "It allows a high-growth period followed by steady long-run growth." },
      { q: "A company loses money, so P/E is meaningless. Which multiple can still be used?", options: ["P/S", "P/E", "Dividend yield"], answer: 0, why: "Sales exist even when profits are negative." },
      { q: "What is a weakness of the method of comparables?", options: ["It needs no data", "If the whole sector is overvalued, it won't show", "It ignores market prices"], answer: 1, why: "It's relative: everything can look fairly priced next to equally overpriced peers." },
    ],
  },
  // 8 ------------------------------------------------------------------------------------------
  {
    id: "technical",
    title: "Technical analysis",
    minutes: 7,
    summary: "Dow theory, chart types, support and resistance, trends and patterns, and what the data says about them.",
    body: () => `
      <p><b>Technical analysis</b> studies past prices and trading volume to judge where prices may go next. It assumes that prices already reflect all known information, that prices move in trends, and that crowd behaviour tends to repeat. <b>Fundamental analysis</b> asks what a company is worth. Technical analysis asks how its price is behaving.</p>
      <h3>Dow theory: the foundation</h3>
      <ul>
        <li>The market has <b>three kinds of trend</b>: the primary trend (months to years), secondary corrections (weeks to months) and minor day-to-day moves.</li>
        <li>Primary trends tend to pass through <b>phases</b>: early buying by informed investors, broad public participation, then speculative excess (and the reverse in a downtrend).</li>
        <li><b>Market averages must confirm each other.</b> In Dow's version, industrial and transport stocks should move the same way.</li>
        <li><b>Volume should confirm the trend</b>, rising in the direction of the main move.</li>
        <li>A trend <b>continues until there is a clear signal</b> that it has reversed.</li>
        <li>Short-term moves can be pushed around by large traders or news. The primary trend can't be.</li>
      </ul>
      <h3>Reading charts</h3>
      <ul>
        <li><b>Line chart:</b> closing prices joined up. It's the clearest view of the trend.</li>
        <li><b>Bar chart:</b> each period shows the open, high, low and close (OHLC).</li>
        <li><b>Candlestick chart:</b> the same information. The "body" spans open to close, coloured by whether the price rose or fell, and the "wicks" show the high and low.</li>
      </ul>
      <h3>Common tools and patterns</h3>
      <ul>
        <li><b>Support</b> is a level where buying has repeatedly stopped falls. <b>Resistance</b> is a level where selling has repeatedly stopped rises. Once broken, they often swap roles.</li>
        <li><b>Trendlines</b> join rising lows (an uptrend) or falling highs (a downtrend). Two parallel lines make a <b>channel</b>.</li>
        <li><b>Head and shoulders:</b> three peaks, the middle one highest, is read as a possible top. The upside-down version is read as a possible bottom.</li>
        <li><b>Moving averages</b> smooth the price. A 50-day average crossing above the 200-day is called a "golden cross", and crossing below a "death cross". Indicators such as <b>RSI</b> and MACD measure momentum.</li>
      </ul>
      <h3>Does it work? Test it</h3>
      <p>Patterns are easy to see afterwards and hard to trade in advance. Here are the real golden and death crosses in DataVest's data, and what happened over the following three months compared with an ordinary day:</p>
      ${W("ma-cross")}
      <p>DataVest's <a href="models.html">RSI tests</a> found signals no better than chance. Treat technical tools as a way to describe price behaviour and manage risk, for example setting stop levels, not as reliable predictions.</p>`,
    takeaways: ["Dow theory: three trends, confirmation by averages and volume.", "Candlesticks and bar charts show open, high, low and close.", "Support and resistance often swap roles once broken.", "Always test a pattern on data before trusting it."],
    quiz: [
      { q: "In Dow theory, which trend can't be manipulated?", options: ["Minor daily moves", "The primary trend", "Secondary corrections"], answer: 1, why: "Large traders or news can push short-term prices, but not the long-term primary trend." },
      { q: "A candlestick's body shows…", options: ["The high and low", "The open and close", "Volume"], answer: 1, why: "The body spans open to close; the wicks mark the high and low." },
      { q: "A price breaks above a long-standing resistance level. That level often becomes…", options: ["Support", "Irrelevant", "A new resistance higher up"], answer: 0, why: "Broken resistance often acts as support afterwards." },
      { q: "What's the best way to judge a chart pattern's usefulness?", options: ["Find a chart where it worked", "Test it systematically on lots of data it wasn't designed on", "Ask an expert"], answer: 1, why: "Cherry-picked examples always look convincing. Systematic, out-of-sample testing is the honest check." },
    ],
  },
  // 9 ------------------------------------------------------------------------------------------
  {
    id: "funds",
    title: "Indexes, funds and ETFs",
    minutes: 8,
    summary: "What indexes are for, active vs passive investing, how funds are priced and charged, plus MPF and hedge funds.",
    body: () => `
      <h3>What an index is for</h3>
      <p>A stock market index tracks a basket of shares. The Hang Seng Index covers the largest companies listed in Hong Kong, and the S&amp;P 500 covers 500 large US companies. Indexes are used to:</p>
      <ul>
        <li><b>measure</b> how a market is doing as a whole</li>
        <li><b>benchmark</b> fund managers and your own portfolio ("did I beat the market?")</li>
        <li>act as an <b>economic signal</b>, since markets tend to move ahead of the economy</li>
        <li>serve as the basis for <b>products</b> such as index funds, ETFs, futures and options</li>
      </ul>
      <p>Most major indexes are weighted by company size (market value), so the biggest companies move them most.</p>
      <h3>Active investing: trying to beat the market</h3>
      <p>Active investors pick investments to beat an index. Famous examples follow very different philosophies. Some buy high-quality businesses at sensible prices and hold them for decades. Others run macro funds that bet on economies, interest rates and currencies, while spreading risk carefully across many assets. The most common vehicle for ordinary investors is the <b>mutual fund</b> (called a unit trust in Hong Kong): many investors pool money, and a professional manager invests it.</p>
      <h3>How a fund is priced and charged</h3>
      <p class="formula">Net asset value (NAV) per unit = (fund assets − fund liabilities) ÷ units outstanding</p>
      <p>You buy and sell fund units at the NAV, usually calculated once a day. Fees can include a <b>subscription</b> (front-end) charge, a yearly <b>management fee</b>, sometimes a <b>performance fee</b>, and a <b>redemption</b> charge when you sell. The yearly charges are taken every year, whether the fund does well or not.</p>
      <p><b>Advantages:</b> instant diversification, professional management, small minimum investments, convenience. <b>Disadvantages:</b> fees, no control over holdings, and many active funds fail to beat their index after fees over long periods.</p>
      <h3>Passive investing: index funds and ETFs</h3>
      <p>Passive investors don't try to beat the market. They buy all of it. An <b>index fund</b> holds the shares in an index, at low cost. An <b>exchange-traded fund (ETF)</b> is an index fund that trades on the stock exchange like a share, at prices throughout the day. Examples are the Tracker Fund of Hong Kong (2800) and SPY in the US. Their returns differ slightly from the index level: they add dividends, and they subtract fees.</p>
      ${W("index-vs-fund")}
      <h3>Your MPF is a set of funds</h3>
      <p>Hong Kong's Mandatory Provident Fund invests employee and employer contributions in funds you choose within your scheme: equity, bond, mixed and money-market funds. If you don't choose, your money goes into the <b>Default Investment Strategy (DIS)</b>. It holds more shares while you're young and shifts gradually towards bonds as retirement nears, and its fees are capped by law. Comparing fund fees in your scheme is one of the most valuable things a young employee can do.</p>
      <h3>Hedge funds</h3>
      <p>Hedge funds are private funds with far fewer restrictions. They can <b>short sell</b> (profit from falls), use <b>leverage</b> (borrowed money that magnifies results), and trade <b>derivatives</b>. Strategies include long/short equity, global macro and quantitative trading. They traditionally charged "2 and 20": 2% of assets a year plus 20% of profits. They are generally limited to professional investors with large portfolios.</p>`,
    takeaways: ["Indexes measure markets, benchmark managers and underlie products.", "Funds are priced at NAV; yearly fees are charged regardless of results.", "Index funds and ETFs buy the whole market cheaply.", "MPF default: the DIS, with fees capped by law."],
    quiz: [
      { q: "A fund has HK$105m in assets, HK$5m in liabilities and 10m units. Its NAV per unit is…", options: ["HK$10.50", "HK$10.00", "HK$11.00"], answer: 1, why: "(105 − 5) ÷ 10 = HK$10 per unit." },
      { q: "What's the main difference between an ETF and an ordinary index fund?", options: ["ETFs trade on an exchange throughout the day", "ETFs can't hold shares", "ETFs never charge fees"], answer: 0, why: "Both can track an index; ETFs are traded like shares during market hours." },
      { q: "Which is NOT a usual function of a market index?", options: ["Benchmark for fund managers", "Basis for index funds and ETFs", "Guaranteeing returns"], answer: 2, why: "An index measures; it guarantees nothing." },
      { q: "A hedge fund charges \"2 and 20\". This means…", options: ["2% of assets yearly + 20% of profits", "20% of assets + 2% of profits", "A HK$2 minimum and HK$20 maximum"], answer: 0, why: "A yearly management fee plus a share of profits (the performance fee)." },
    ],
  },
  // 10 -----------------------------------------------------------------------------------------
  {
    id: "strategies",
    title: "Ten investing strategies",
    minutes: 8,
    summary: "From buy-and-hold to contrarian investing, plus a real test of dollar-cost averaging vs investing a lump sum.",
    body: () => `
      <ol class="strategies">
        <li><b>Buy and hold.</b> Buy good investments, often a broad index, and keep them for years, ignoring short-term swings. It has low costs and little stress, and it captures the market's long-run growth. It needs patience through bear markets.</li>
        <li><b>Market timing.</b> Move in and out of the market to avoid falls. It sounds attractive, but you must be right twice: when to sell and when to buy back. Missing a handful of the best days, which often come right after the worst ones, can cut long-run returns sharply.</li>
        <li><b>Growth investing.</b> Buy companies whose sales and profits grow fast, often at high P/E ratios. When growth delivers, the rewards are big. When it slows, prices can fall hard.</li>
        <li><b>Value investing.</b> Buy companies priced below their intrinsic value, often with low P/E or P/B ratios. It needs patience, and the discipline to tell a bargain from a business in decline (a "value trap").</li>
        <li><b>GARP (growth at a reasonable price).</b> A middle path: growing companies at sensible valuations. It is often screened with the PEG ratio, which is P/E divided by the growth rate.</li>
        <li><b>Quality investing.</b> Focus on businesses with high, steady returns on capital, strong balance sheets and lasting competitive advantages, even at a fair rather than cheap price.</li>
        <li><b>Income investing.</b> Choose shares with reliable, growing dividends for regular cash. Check that dividends are covered by cash flow: a very high yield can be a warning sign.</li>
        <li><b>Dollar-cost averaging (DCA).</b> Invest a fixed amount at regular intervals, such as every month. You automatically buy more units when prices are low and fewer when high, and it removes the stress of choosing a moment.</li>
        <li><b>Dogs of the Dow.</b> Each year, buy the ten highest-dividend-yield stocks in the Dow Jones Industrial Average in equal amounts, then repeat. It is a simple, rules-based value and income approach.</li>
        <li><b>Contrarian investing.</b> Buy what is out of favour and sell what is popular, betting that crowds overreact. It requires conviction and comfort with being early, and sometimes wrong.</li>
      </ol>
      <h3>Test it: dollar-cost averaging vs a lump sum</h3>
      <p>If you already have a sum to invest, is it better to put it all in at once, or spread it over a year? Here is what actually happened for every possible starting month in DataVest's data:</p>
      ${W("dca")}
      <p>In markets that mostly rise, investing a lump sum straight away usually wins, because money spends more time invested. DCA wins when prices fall during the buying period. DCA's real strength is behavioural: it makes regular investing automatic and avoids regret about bad timing. For a monthly salary, it's the natural way to invest anyway.</p>`,
    takeaways: ["No strategy wins in all markets.", "Market timing must be right twice; missing the best days is costly.", "Value vs growth: cheap vs fast-growing; GARP sits between.", "Lump sum usually beats DCA in rising markets; DCA reduces timing regret."],
    quiz: [
      { q: "Why is market timing so difficult?", options: ["You must be right about when to sell AND when to buy back", "Brokers forbid it", "Prices never fall"], answer: 0, why: "Two correct decisions are needed, and the best days often come soon after the worst." },
      { q: "A P/E of 30 and earnings growth of 30% a year gives a PEG of…", options: ["1", "0.3", "900"], answer: 0, why: "PEG = P/E ÷ growth (in %) = 30 ÷ 30 = 1." },
      { q: "With DCA, when prices fall during the buying period you…", options: ["Buy fewer units", "Buy more units with the same money", "Stop buying"], answer: 1, why: "A fixed amount buys more units at lower prices." },
      { q: "A share offers a 12% dividend yield, far above its peers. A careful income investor should…", options: ["Buy immediately", "Check whether the dividend is covered by cash flow", "Ignore dividends"], answer: 1, why: "An unusually high yield often means the market expects a dividend cut." },
    ],
  },
  // 11 -----------------------------------------------------------------------------------------
  {
    id: "behaviour",
    title: "Behavioural finance: your own worst enemy",
    minutes: 7,
    summary: "The mental biases that cost investors money, and practical ways to guard against them.",
    body: () => `
      <p><b>Traditional finance</b> assumes investors are rational and markets price information correctly. <b>Behavioural finance</b> studies how real people actually decide, with predictable mental shortcuts and emotions that can lead to costly mistakes and help explain market bubbles and crashes.</p>
      <h3>Seven common biases</h3>
      <ul>
        <li><b>Overconfidence:</b> overrating your own skill and knowledge, which leads to trading too much and holding too few investments. It is often fed by <b>self-attribution bias</b>: crediting wins to skill and blaming losses on bad luck.</li>
        <li><b>Loss aversion:</b> losses hurt roughly twice as much as equal gains feel good. Investors hold losers too long, hoping to "get back to even", and sell winners too early.</li>
        <li><b>Inertia (status quo bias):</b> sticking with the current choice, such as an unsuitable MPF fund or a cash pile, simply because changing takes effort.</li>
        <li><b>Framing:</b> reacting differently to the same facts depending on how they're presented. "90% survival" feels better than "10% fail".</li>
        <li><b>Anchoring:</b> fixing on an irrelevant number, such as the price you paid or a past peak, and judging everything against it.</li>
        <li><b>Representativeness:</b> judging by stereotypes and recent patterns, such as "a great company must be a great investment" or "it rose five years in a row, so it will keep rising".</li>
        <li><b>Conservatism:</b> updating your views too slowly when new evidence arrives.</li>
      </ul>
      <h3>How to guard against them</h3>
      <ul>
        <li><b>Use a checklist</b> before every investment decision (try the one below).</li>
        <li><b>Play devil's advocate:</b> write down the strongest case against your idea, or ask someone to argue it.</li>
        <li><b>Write your reasons down</b> when you buy. Later, judge the decision on whether those reasons held, not on the price alone.</li>
        <li><b>Automate:</b> regular investing and a fixed rebalancing schedule take emotion out of timing.</li>
        <li><b>Diversify</b>, so no single mistake can do serious damage.</li>
      </ul>
      ${W("checklist")}
      <h3>Traits of successful investors</h3>
      <p>Patience, discipline, humility about what they can't know, independence from the crowd, and a habit of learning from mistakes rather than explaining them away. None of these need genius. They need a process.</p>`,
    takeaways: ["Biases are predictable, so they can be planned for.", "Loss aversion and anchoring keep investors in losing positions.", "Overconfidence leads to overtrading.", "Checklists, written reasons and automation beat willpower."],
    quiz: [
      { q: "You won't sell a share until it gets back to the price you paid. Which bias is this mainly?", options: ["Anchoring (with loss aversion)", "Framing", "Conservatism"], answer: 0, why: "You're anchored on your purchase price, and loss aversion makes selling below it painful." },
      { q: "You credit your winning trades to skill and losing ones to bad luck. This is…", options: ["Self-attribution bias", "Inertia", "Representativeness"], answer: 0, why: "It inflates confidence and leads to overtrading." },
      { q: "You've left your MPF in the same fund for years without checking it. This is most likely…", options: ["Inertia", "Overconfidence", "Anchoring"], answer: 0, why: "Status quo bias: not changing because changing takes effort." },
      { q: "Which habit best protects against overconfidence?", options: ["Trading more often", "Writing down the case against your idea before investing", "Following hot tips"], answer: 1, why: "Actively seeking disconfirming evidence counters overconfidence." },
    ],
  },
];
