// Learn page: one lesson at a time, quiz at the end, progress saved in this browser.
import { LESSONS } from "./lessons.js";
import { $, esc, getJSON, renderTopBar } from "./common.js";

const KEY = "datavest.progress";
let progress = {};
try { progress = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { progress = {}; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { /* storage blocked */ } };

let data = { insights: null, models: null, names: {} };
let current = null;

function renderList() {
  $("lesson-list").innerHTML = LESSONS.map((l) => {
    const p = progress[l.id];
    const state = p?.best === l.quiz.length ? "done" : p ? "tried" : "";
    const badge = p ? `<span class="badge ${state}" aria-label="Best score ${p.best} of ${l.quiz.length}">${p.best}/${l.quiz.length}</span>` : "";
    return `<li><a href="#${l.id}"${current?.id === l.id ? ' aria-current="page"' : ""}><span>${esc(l.title)}</span>${badge}</a></li>`;
  }).join("");
  const done = LESSONS.filter((l) => progress[l.id]?.best === l.quiz.length).length;
  $("progress").textContent = done === LESSONS.length
    ? "All lessons completed with full marks."
    : `${done} of ${LESSONS.length} lessons completed with full marks.`;
}

function renderLesson(id) {
  const i = Math.max(0, LESSONS.findIndex((l) => l.id === id));
  const l = LESSONS[i];
  current = l;
  document.title = `DataVest · ${l.title}`;
  $("l-kicker").textContent = `Lesson ${i + 1} of ${LESSONS.length}, about ${l.minutes} minutes`;
  $("l-title").textContent = l.title;
  $("l-summary").textContent = l.summary;
  $("l-body").innerHTML = l.body(data);
  $("l-takeaways").innerHTML = l.takeaways.map((t) => `<li>${esc(t)}</li>`).join("");

  $("quiz").innerHTML = l.quiz.map((item, qi) => `
    <fieldset class="q" data-q="${qi}">
      <legend><span class="qn">${qi + 1}.</span> ${esc(item.q)}</legend>
      ${item.options.map((o, oi) => `
        <label class="opt"><input type="radio" name="q${qi}" value="${oi}"> <span>${esc(o)}</span></label>`).join("")}
      <p class="why" hidden></p>
    </fieldset>`).join("");
  $("quiz-score").textContent = "";
  $("check").hidden = false;
  const next = LESSONS[i + 1];
  $("next").hidden = true;
  $("next").href = next ? `#${next.id}` : "tools.html";
  $("next").textContent = next ? `Next lesson: ${next.title}` : "Try the money tools";
  renderList();
  window.scrollTo({ top: 0 });
}

function check() {
  const l = current;
  let score = 0;
  let answered = 0;
  l.quiz.forEach((item, qi) => {
    const box = document.querySelector(`.q[data-q="${qi}"]`);
    const chosen = box.querySelector("input:checked");
    const why = box.querySelector(".why");
    box.classList.remove("right", "wrong");
    box.querySelectorAll(".opt").forEach((o) => o.classList.remove("is-answer"));
    if (!chosen) return;
    answered++;
    const ok = Number(chosen.value) === item.answer;
    if (ok) score++;
    box.classList.add(ok ? "right" : "wrong");
    box.querySelectorAll(".opt")[item.answer].classList.add("is-answer");
    why.hidden = false;
    why.innerHTML = `<b>${ok ? "Correct." : "Not quite."}</b> ${esc(item.why)}`;
  });
  if (answered < l.quiz.length) {
    $("quiz-score").textContent = `Answer all ${l.quiz.length} questions to see your score (${answered} answered so far).`;
    return;
  }
  const prev = progress[l.id]?.best || 0;
  progress[l.id] = { best: Math.max(prev, score), last: score };
  save();
  $("quiz-score").textContent = score === l.quiz.length
    ? `${score} out of ${l.quiz.length}. Full marks!`
    : `${score} out of ${l.quiz.length}. Read the explanations and try again any time.`;
  $("next").hidden = false;
  renderList();
}

async function init() {
  renderTopBar("learn");
  $("check").addEventListener("click", check);
  window.addEventListener("hashchange", () => renderLesson(location.hash.slice(1)));
  renderLesson(location.hash.slice(1)); // show content straight away; real numbers fill in when loaded
  const [meta, insights, models] = await Promise.all(
    ["data/tickers.json", "data/insights.json", "data/models.json"].map((u) => getJSON(u).catch(() => null))
  );
  data = { insights, models, names: Object.fromEntries((meta?.tickers || []).map((t) => [t.symbol, t.name])) };
  $("l-body").innerHTML = current.body(data);
}

init();
