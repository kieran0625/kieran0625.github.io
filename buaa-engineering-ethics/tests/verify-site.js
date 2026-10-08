// 无第三方依赖的导入、渲染和交互逻辑校验；不替代真实浏览器的布局检查。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const bank = JSON.parse(read('questions.json'));
let checks = 0;
function test(name, run) { run(); checks++; console.log(`✓ ${name}`); }

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
  assert(window.__test, '测试入口注入失败');
  function click(selector, dataset) {
    element(selector).listeners.click({ target: { closest: () => ({ dataset }) } });
  }
  return { api: window.__test, element, click, saved: () => stored };
}

test('全部题干、选项数量与原始习题一致', () => {
  assert.equal(bank.questions.length, 303);
  for (const chapter of bank.chapters) {
    const source = read(`第${chapter.number}讲 ${chapter.title} 习题.md`);
    const questions = bank.questions.filter(q => q.chapter === chapter.number);
    const rawOptions = source.match(/^- [A-E][.、．]/gm) || [];
    assert.equal(questions.filter(q => q.type !== 'boolean').reduce((sum, q) => sum + q.options.length, 0), rawOptions.length);
    for (const question of questions) assert(source.includes(question.stem), `${question.id} 题干被更改`);
  }
});
test('生成页面不依赖外部脚本、字体或网络资源', () => {
  const html = read('index.html');
  assert(!/<script[^>]+src=/i.test(html));
  assert(!/INLINE_(STYLES|DATA|APP)/.test(html));
  assert(!/@import|https?:\/\/[^\s)]+\.(?:css|woff2?|js)/.test(read('web/styles.css')));
  for (const script of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
});
test('首次加载渲染 20 题，背题模式显示答案', () => {
  const { element } = boot();
  const html = element('#question-list').innerHTML;
  assert.equal((html.match(/class="question-card"/g) || []).length, 20);
  assert.equal((html.match(/class="answer-panel"[^>]* hidden/g) || []).length, 0);
  assert(element('#result-summary').textContent.includes('303'));
});
test('15 讲与三种题型均可筛选，支持组合及空结果', () => {
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
test('搜索覆盖选项，大小写不敏感，空格分隔多关键词', () => {
  const { api } = boot();
  api.changeFilter('query', 'finfet');
  assert(api.filteredQuestions().some(q => q.id === '15-8'));
  api.changeFilter('query', '伦理 康德');
  assert(api.filteredQuestions().every(q => `${q.stem} ${q.options.map(o => o.text).join(' ')}`.includes('康德')));
  api.changeFilter('query', '找不到的关键字[.*');
  assert.equal(api.filteredQuestions().length, 0);
});
test('搜索高亮与 Markdown 渲染转义 HTML、正则字符', () => {
  const { api } = boot();
  api.state.query = '[.*';
  assert.equal(api.highlight('<b>[.*</b>'), '&lt;b&gt;<mark>[.*</mark>&lt;/b&gt;');
  assert.equal(api.markdown('**重点** <script>'), '<p><strong>重点</strong> &lt;script&gt;</p>');
});
test('多选判定与选项顺序无关，漏选和多选均判错', () => {
  const { api } = boot();
  assert(api.sameAnswer(['D', 'A', 'B'], ['A', 'B', 'D']));
  assert(!api.sameAnswer(['A', 'B'], ['A', 'B', 'D']));
  assert(!api.sameAnswer(['A', 'B', 'C', 'D'], ['A', 'B', 'D']));
  assert(api.sameAnswer(['√'], ['√']));
  assert(!api.sameAnswer(['×'], ['√']));
});
test('所有 303 题可渲染，含五选项和判断题', () => {
  const { api } = boot();
  for (const question of bank.questions) {
    const html = api.renderCard(question);
    assert.equal((html.match(/class="option-key"/g) || []).length, question.options.length, question.id);
    assert(html.includes(`id="answer-${question.id}"`));
    assert(html.includes('查看解析'));
    assert.equal((html.match(/correct-option/g) || []).length, question.answer.length, question.id);
  }
  assert.equal(bank.questions.find(q => q.id === '7-9').options.length, 5);
  assert.equal(bank.questions.find(q => q.id === '10-3').answer.join(''), 'C');
});
test('练习模式隐藏答案及会泄露答案的资料提示', () => {
  const { api, click } = boot();
  click('.mode-control', { mode: 'practice' });
  for (const question of bank.questions) {
    const html = api.renderCard(question);
    assert(html.includes(`id="answer-${question.id}" hidden`));
    assert(!html.includes('correct-option'));
    if (question.note && question.id !== '8-15') assert(!html.includes('class="source-note"'));
  }
  assert(api.renderCard(bank.questions.find(q => q.id === '8-15')).includes('原题为图片选项'));
});
test('提交判题、错题筛选、重做与成绩更新', () => {
  const { api, click, saved } = boot();
  click('.mode-control', { mode: 'practice' });
  api.drafts.set('1-1', ['A']);
  click('#question-list', { action: 'submit', id: '1-1' });
  assert.equal(api.getAttempts()['1-1'].correct, false);
  assert(api.isRevealed(bank.questions[0]));
  api.changeFilter('scope', 'wrong');
  assert.equal(api.filteredQuestions().length, 1);
  click('#question-list', { action: 'retry', id: '1-1' });
  assert.equal(api.filteredQuestions().length, 1, '重做期间不应移出错题列表');
  assert(!api.isRevealed(bank.questions[0]));
  api.drafts.set('1-1', ['C']);
  click('#question-list', { action: 'submit', id: '1-1' });
  assert.equal(api.getAttempts()['1-1'].correct, true);
  assert.equal(api.filteredQuestions().length, 0);
  assert.equal(JSON.parse(saved()).attempts['1-1'].correct, true);
});
test('多选提交、判断题提交与未练习筛选联动', () => {
  const { api, click } = boot();
  click('.mode-control', { mode: 'practice' });
  api.changeFilter('scope', 'unanswered');
  api.drafts.set('7-9', ['E', 'D', 'C', 'B', 'A']);
  click('#question-list', { action: 'submit', id: '7-9' });
  api.drafts.set('1-18', ['×']);
  click('#question-list', { action: 'submit', id: '1-18' });
  assert(api.getAttempts()['7-9'].correct);
  assert(api.getAttempts()['1-18'].correct);
  assert.equal(api.filteredQuestions().length, 301);
});
test('收藏与取消收藏即时更新筛选，并可恢复本地记录', () => {
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
test('损坏、不可用和非法本地记录不影响打开', () => {
  assert.equal(boot('{not json').api.filteredQuestions().length, 303);
  assert.equal(boot(null, true).api.filteredQuestions().length, 303);
  const { api } = boot(JSON.stringify({ bookmarks: ['bad-id'], attempts: { '1-1': { selected: ['Z'], correct: true }, 'unknown': { selected: ['A'] }, '1-2': { selected: ['A'], correct: true } } }));
  assert.equal(api.getBookmarks().size, 0);
  assert.equal(Object.keys(api.getAttempts()).length, 1);
  assert.equal(api.getAttempts()['1-2'].correct, false, '恢复时应根据当前参考答案重新判定');
});
test('分页、末页和每页全部题目无遗漏', () => {
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
test('随机排序保持全部题目且筛选重绘时顺序稳定', () => {
  const { api } = boot();
  api.shuffle();
  api.state.order = 'random';
  const first = api.filteredQuestions().map(q => q.id).join(',');
  assert.equal(new Set(api.filteredQuestions().map(q => q.id)).size, 303);
  assert.equal(api.filteredQuestions().map(q => q.id).join(','), first);
  api.changeFilter('chapter', 1);
  assert.equal(api.filteredQuestions().length, 20);
});
console.log(`\n${checks} 组校验通过（数据、HTML 生成与事件逻辑；不包含浏览器布局校验）。`);
