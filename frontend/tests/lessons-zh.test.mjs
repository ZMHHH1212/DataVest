import test from "node:test";
import assert from "node:assert/strict";

// i18n.js reads the address and storage when imported; give it a minimal browser-like setting
globalThis.location = { search: "?lang=zh", href: "" };
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.document = { documentElement: {} };

const { FOUNDATIONS } = await import("../js/lessons.js");
const { INVESTING } = await import("../js/lessons-investing.js");
const { ZH_LESSONS } = await import("../js/lessons-zh.js");
const data = { insights: null, models: null, names: {} };

for (const l of [...FOUNDATIONS, ...INVESTING]) {
  test(`Chinese lesson "${l.id}" matches the English one`, () => {
    const z = ZH_LESSONS[l.id];
    assert.ok(z, "translation exists");
    assert.equal(z.quiz.length, l.quiz.length, "same number of questions");
    z.quiz.forEach((q, i) => assert.equal(q.options.length, l.quiz[i].options.length, `question ${i + 1} has the same options`));
    assert.equal(z.takeaways.length, l.takeaways.length, "same number of key points");
    const widgets = (html) => (html.match(/data-widget="[^"]+"/g) || []).join();
    assert.equal(widgets(z.body(data)), widgets(l.body(data)), "same interactive tools");
  });
}
