// u65e0u7b2cu4e09u65b9u4f9du8d56u7684u5bfcu5165u3001u6e32u67d3u548cu4ea4u4e92u903bu8f91u6821u9a8cuff1bu4e0du66ffu4ee3u771fu5b9eu6d4fu89c8u5668u7684u5e03u5c40u68c0u67e5u3002
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const bank = JSON.parse(read('questions.json'));
let checks = 0;
function test(name, run) { run(); checks++; console.log(`u2713 ${name}`); }

function boot(saved = null, blockStorage = false) {
  const elements = new Map();
  function element(selector) {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', textContent: '', hidden: false, value: '', listeners: {},
      addEventListener(event, handler) { this.listeners[event] = handler; },
      setAttribute() {}, focus() {}, scrollIntoView() {}, querySelectorAll() { return []; },
      querySelector(child) { return element(`${selector} ${child}`); }
    });
    return elements.get(selector);
  }
  let stored = saved;
  const document = { querySelector: element, querySelectorAll: () => [], addEventListener() {} };
  const window = { QUESTION_BANK: bank, addEventListener() {}, scrollTo() {}, matchMedia: () => ({ matches: true }) };
  const context = vm.createContext({
    window, document, console,
    localStorage: {
      getItem() { if (blockStorage) throw Error('storage disabled'); return stored; },
      setItem(key, value) { if (blockStorage) throw Error('storage disabled'); stored = value; }
    },
    setTimeout: () => 1, clearTimeout() {}
  });
  const expose = 'window.__test = { state, drafts, answerVisibility, filteredQuestions, sameAnswer, highlight, markdown, renderCard, renderQuestions, changeFilter, resetFilters, shuffle, isRevealed, persist, getAttempts: () => attempts, getBookmarks: () => bookmarks };';
  const app = read('web/app.js').replace(/  render\(\);\n\}\)\(\);\s*$/, `  render();\n  ${expose}\n})();`);
  vm.runInContext(app, context);
  assert(window.__test, 'u6d4bu8bd5u5165u53e3u6ce8u5165u5931u8d25');
  function click(selector, dataset) {
    element(selector).listeners.click({ target: { closest: () => ({ dataset }) } });
  }
  return { api: window.__test, element, click, saved: () => stored };
}

test('u5168u90e8u9898u5e72u3001u9009u9879u6570u91cfu4e0eu539fu59cbu4e60u9898u4e00u81f4', () => {
  assert.equal(bank.questions.length, 303);
  for (const chapter of bank.chapters) {
    const source = read(`u7b2c${chapter.number}u8bb2 ${chapter.title} u4e60u9898.md`);
    const questions = bank.questions.filter(q => q.chapter === chapter.number);
    const rawOptions = source.match(/^- [A-E][.u3001uff0e]/gm) || [];
    assert.equal(questions.filter(q => q.type !== 'boolean').reduce((sum, q) => sum + q.options.length, 0), rawOptions.length);
    for (const question of questions) assert(source.includes(question.stem), `${question.id} u9898u5e72u88abu66f4u6539`);
  }
});
test('u751fu6210u9875u9762u4e0du4f9du8d56u5916u90e8u811au672cu3001u5b57u4f53u6216u7f51u7edcu8d44u6e90', () => {
  const html = read('index.html');
  assert(!/<script[^>]+src=/i.test(html));
  assert(!/INLINE_(STYLES|DATA|APP)/.test(html));
  assert(!/@import|https?:\/\/[^\s)]+\.(?:css|woff2?|js)/.test(read('web/styles.css')));
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
});
test('u9996u6b21u52a0u8f7du6e32u67d3 20 u9898uff0cu80ccu9898u6a21u5f0fu663eu793au7b54u6848', () => {
  const { element } = boot();
  const html = element('#question-list').innerHTML;
  assert.equal((html.match(/class="question-card"/g) || []).length, 20);
  assert.equal((html.match(/class="answer-panel"[^>]* hidden/g) || []).length, 0);
  assert(element('#result-summary').textContent.includes('303'));
});
test('15 u8bb2u4e0eu4e09u79cdu9898u578bu5747u53efu7b5bu9009uff0cu652fu6301u7ec4u5408u53cau7a7au7ed3u679c', () => {
  const { api } = boot();
  for (const chapter of bank.chapters) {
    api.changeFilter('chapter', chapter.number);
    assert.equal(api.filteredQuestions().length, chapter.count);
  }
  api.resetFilters();
  for (const [type, count] of [['single', 109], ['multiple', 122], ['boolean', 72]]) {
    api.changeFilter('type', type);
    assert.equal(api.filteredQuestions().length, count);
  }
  api.changeFilter('chapter', 9);
  api.changeFilter('type', 'single');
  assert.equal(api.filteredQuestions().length, 0);
  api.changeFilter('type', 'multiple');
  assert.equal(api.filteredQuestions().length, 10);
});
test('u641cu7d22u8986u76d6u9009u9879uff0cu5927u5c0fu5199u4e0du654fu611fuff0cu7a7au683cu5206u9694u591au5173u952eu8bcd', () => {
  const { api } = boot();
  api.changeFilter('query', 'finfet');
  assert(api.filteredQuestions().some(q => q.id === '15-8'));
  api.changeFilter('query', 'u4f26u7406 u5eb7u5fb7');
  assert(api.filteredQuestions().every(q => `${q.stem} ${q.options.map(o => o.text).join(' ')}`.includes('u5eb7u5fb7')));
  api.changeFilter('query', 'u627eu4e0du5230u7684u5173u952eu5b57[.*');
  assert.equal(api.filteredQuestions().length, 0);
});
test('u641cu7d22u9ad8u4eaeu4e0e Markdown u6e32u67d3u8f6cu4e49 HTMLu3001u6b63u5219u5b57u7b26', () => {
  const { api } = boot();
  api.state.query = '[.*';
  assert.equal(api.highlight('<b>[.*</b>'), '&lt;b&gt;<mark>[.*</mark>&lt;/b&gt;');
  assert.equal(api.markdown('**u91cdu70b9** <script>'), '<p><strong>u91cdu70b9</strong> &lt;script&gt;</p>');
});
test('u591au9009u5224u5b9au4e0eu9009u9879u987au5e8fu65e0u5173uff0cu6f0fu9009u548cu591au9009u5747u5224u9519', () => {
  const { api } = boot();
  assert(api.sameAnswer(['D', 'A', 'B'], ['A', 'B', 'D']));
  assert(!api.sameAnswer(['A', 'B'], ['A', 'B', 'D']));
  assert(!api.sameAnswer(['A', 'B', 'C', 'D'], ['A', 'B', 'D']));
  assert(api.sameAnswer(['u221a'], ['u221a']));
  assert(!api.sameAnswer(['u00d7'], ['u221a']));
});
test('u6240u6709 303 u9898u53efu6e32u67d3uff0cu542bu4e94u9009u9879u548cu5224u65adu9898', () => {
  const { api } = boot();
  for (const question of bank.questions) {
    const html = api.renderCard(question);
    assert.equal((html.match(/class="option-key"/g) || []).length, question.options.length, question.id);
    assert(html.includes(`id="answer-${question.id}"`));
    assert(html.includes('u67e5u770bu89e3u6790'));
    assert.equal((html.match(/correct-option/g) || []).length, question.answer.length, question.id);
  }
  assert.equal(bank.questions.find(q => q.id === '7-9').options.length, 5);
  assert.equal(bank.questions.find(q => q.id === '10-3').answer.join(''), 'C');
});
test('u7ec3u4e60u6a21u5f0fu9690u85cfu7b54u6848u53cau4f1au6cc4u9732u7b54u6848u7684u8d44u6599u63d0u793a', () => {
  const { api, click } = boot();
  click('.mode-control', { mode: 'practice' });
  for (const question of bank.questions) {
    const html = api.renderCard(question);
    assert(html.includes(`id="answer-${question.id}" hidden`));
    assert(!html.includes('correct-option'));
    if (question.note && question.id !== '8-15') assert(!html.includes('class="source-note"'));
  }
  assert(api.renderCard(bank.questions.find(q => q.id === '8-15')).includes('u539fu9898u4e3au56feu7247u9009u9879'));
});
test('u63d0u4ea4u5224u9898u3001u9519u9898u7b5bu9009u3001u91cdu505au4e0eu6210u7ee9u66f4u65b0', () => {
  const { api, click, saved } = boot();
  click('.mode-control', { mode: 'practice' });
  api.drafts.set('1-1', ['A']);
  click('#question-list', { action: 'submit', id: '1-1' });
  assert.equal(api.getAttempts()['1-1'].correct, false);
  assert(api.isRevealed(bank.questions[0]));
  api.changeFilter('scope', 'wrong');
  assert.equal(api.filteredQuestions().length, 1);
  click('#question-list', { action: 'retry', id: '1-1' });
  assert.equal(api.filteredQuestions().length, 1, 'u91cdu505au671fu95f4u4e0du5e94u79fbu51fau9519u9898u5217u8868');
  assert(!api.isRevealed(bank.questions[0]));
  api.drafts.set('1-1', ['C']);
  click('#question-list', { action: 'submit', id: '1-1' });
  assert.equal(api.getAttempts()['1-1'].correct, true);
  assert.equal(api.filteredQuestions().length, 0);
  assert.equal(JSON.parse(saved()).attempts['1-1'].correct, true);
});
test('u591au9009u63d0u4ea4u3001u5224u65adu9898u63d0u4ea4u4e0eu672au7ec3u4e60u7b5bu9009u8054u52a8', () => {
  const { api, click } = boot();
  click('.mode-control', { mode: 'practice' });
  api.changeFilter('scope', 'unanswered');
  api.drafts.set('7-9', ['E', 'D', 'C', 'B', 'A']);
  click('#question-list', { action: 'submit', id: '7-9' });
  api.drafts.set('1-18', ['u00d7']);
  click('#question-list', { action: 'submit', id: '1-18' });
  assert(api.getAttempts()['7-9'].correct);
  assert(api.getAttempts()['1-18'].correct);
  assert.equal(api.filteredQuestions().length, 301);
});
test('u6536u85cfu4e0eu53d6u6d88u6536u85cfu5373u65f6u66f4u65b0u7b5bu9009uff0cu5e76u53efu6062u590du672cu5730u8bb0u5f55', () => {
  const first = boot();
  first.click('#question-list', { action: 'bookmark', id: '1-1' });
  first.api.changeFilter('scope', 'bookmarked');
  assert.equal(first.api.filteredQuestions().length, 1);
  const second = boot(first.saved());
  assert(second.api.getBookmarks().has('1-1'));
  second.api.changeFilter('scope', 'bookmarked');
  second.click('#question-list', { action: 'bookmark', id: '1-1' });
  assert.equal(second.api.filteredQuestions().length, 0);
});
test('u635fu574fu3001u4e0du53efu7528u548cu975eu6cd5u672cu5730u8bb0u5f55u4e0du5f71u54cdu6253u5f00', () => {
  assert.equal(boot('{not json').api.filteredQuestions().length, 303);
  assert.equal(boot(null, true).api.filteredQuestions().length, 303);
  const { api } = boot(JSON.stringify({ bookmarks: ['bad-id'], attempts: { '1-1': { selected: ['Z'], correct: true }, 'unknown': { selected: ['A'] }, '1-2': { selected: ['A'], correct: true } } }));
  assert.equal(api.getBookmarks().size, 0);
  assert.equal(Object.keys(api.getAttempts()).length, 1);
  assert.equal(api.getAttempts()['1-2'].correct, false, 'u6062u590du65f6u5e94u6839u636eu5f53u524du53c2u8003u7b54u6848u91cdu65b0u5224u5b9a');
});
test('u5206u9875u3001u672bu9875u548cu6bcfu9875u5168u90e8u9898u76eeu65e0u9057u6f0f', () => {
  const { api, element } = boot();
  api.state.page = 16;
  api.renderQuestions();
  assert.equal((element('#question-list').innerHTML.match(/class="question-card"/g) || []).length, 3);
  api.changeFilter('chapter', 12);
  assert.equal(api.state.page, 1);
  api.resetFilters();
  api.state.pageSize = 303;
  api.renderQuestions();
  assert.equal((element('#question-list').innerHTML.match(/class="question-card"/g) || []).length, 303);
});
test('u968fu673au6392u5e8fu4fddu6301u5168u90e8u9898u76eeu4e14u7b5bu9009u91cdu7ed8u65f6u987au5e8fu7a33u5b9a', () => {
  const { api } = boot();
  api.shuffle();
  api.state.order = 'random';
  const first = api.filteredQuestions().map(q => q.id).join(',');
  assert.equal(new Set(api.filteredQuestions().map(q => q.id)).size, 303);
  assert.equal(api.filteredQuestions().map(q => q.id).join(','), first);
  api.changeFilter('chapter', 1);
  assert.equal(api.filteredQuestions().length, 20);
});
console.log(`\n${checks} u7ec4u6821u9a8cu901au8fc7uff08u6570u636eu3001HTML u751fu6210u4e0eu4e8bu4ef6u903bu8f91uff1bu4e0du5305u542bu6d4fu89c8u5668u5e03u5c40u6821u9a8cuff09u3002`);
