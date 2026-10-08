// 真实 Chrome 检查。依赖 playwright-core，仅用于开发检查，网页仍可独立离线使用。
// node tests/browser-check.js /path/to/node_modules/playwright-core
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.argv[2] || 'playwright-core');
const root = path.join(__dirname, '..');
const output = path.join(root, 'artifacts/browser-check');
const url = pathToFileURL(path.join(root, 'index.html')).href;
const report = { checkedAt: new Date().toISOString(), delivery: 'file://, offline', viewports: [], checks: [], errors: [], networkRequests: [] };
const executablePath = process.env.BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ executablePath, headless: true });
  report.browser = await browser.version();
  const context = await browser.newContext({ offline: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) report.networkRequests.push(request.url()); });
  const card = id => page.locator(`[data-question="${id}"]`);
  const screenshot = async name => page.screenshot({ path: path.join(output, `${name}.png`) });
  // 卡片特写排除悬浮控件；常规视口截图仍保留提示和返回顶部按钮。
  const cardshot = async (id, name) => card(id).screenshot({ path: path.join(output, `${name}.png`), style: '.skip-link,.back-to-top,#toast{visibility:hidden!important}' });
  const check = async (name, run) => { await run(); report.checks.push(name); console.log(`✓ ${name}`); };
  async function layout() {
    return page.evaluate(() => ({
      width: innerWidth, pageWidth: document.documentElement.scrollWidth,
      overflow: [...document.querySelectorAll('body *')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width && (r.right > innerWidth + 1 || r.left < -1) && !el.matches('.sr-only');
      }).map(el => `${el.tagName}.${el.className}`).slice(0, 10),
      clippedText: [...document.querySelectorAll('.option-text, .question-card h3, .explanation-body, .overview strong, .stat-label')]
        .filter(el => el.clientWidth && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.slice(0, 80))
    }));
  }
  async function assertLayout() {
    const result = await layout();
    assert.equal(result.pageWidth, result.width, `页面存在横向溢出：${JSON.stringify(result)}`);
    assert.deepEqual(result.overflow, [], '元素超出视口');
    assert.deepEqual(result.clippedText, [], '文字被裁切');
    return result;
  }
  try {
    await check('桌面、断点两侧、平板及手机共 10 个尺寸无横向溢出', async () => {
      for (const [name, width, height] of [
        ['desktop',1440,1000], ['laptop',1024,900], ['sidebar-edge',851,900], ['single-column-edge',850,900],
        ['tablet',768,1024], ['mobile-edge-above',561,900], ['mobile-edge',560,900], ['mobile',390,844],
        ['mobile-small',375,812], ['narrow',320,740]
      ]) {
        await page.setViewportSize({ width, height });
        await page.goto(url);
        assert.equal(await page.locator('.question-card').count(), 20);
        assert.equal(await page.locator('.sidebar').isVisible(), width > 850);
        assert.equal(await page.locator('.mobile-chapter').isVisible(), width <= 850);
        report.viewports.push({ name, height, ...await assertLayout() });
        await screenshot(name);
      }
    });
    await check('320px 下全部 303 题及展开解析均无溢出或文字裁切', async () => {
      await page.selectOption('#page-size', '303');
      assert.equal(await page.locator('.question-card').count(), 303);
      await page.locator('details').evaluateAll(details => details.forEach(el => { el.open = true; }));
      await assertLayout();
      const longest = await page.locator('.question-card').evaluateAll(cards => cards.reduce((a, b) => a.getBoundingClientRect().height > b.getBoundingClientRect().height ? a : b).dataset.question);
      report.longestCard = longest;
      await cardshot(longest, 'narrow-long-explanation');
      await page.click('[data-mode="practice"]');
      await assertLayout();
      await page.goto(url);
    });
    await check('全部 15 讲可通过手机下拉筛选，长章节标题正常显示', async () => {
      const chapters = await page.evaluate(() => window.QUESTION_BANK.chapters);
      for (const chapter of chapters) {
        await page.selectOption('#chapter-select', String(chapter.number));
        assert((await page.locator('#result-summary').innerText()).includes(`共 ${chapter.count} 题`));
        await assertLayout();
      }
      await screenshot('narrow-chapter');
    });
    await check('搜索高亮、组合筛选空结果及重置可用', async () => {
      await page.click('#reset-filters');
      await page.fill('#search', 'finfet');
      assert(await card('15-8').isVisible());
      assert(await page.locator('mark').count() > 0);
      await page.selectOption('#chapter-select', '1');
      assert(await page.locator('.empty-state').isVisible());
      await screenshot('narrow-empty');
      await page.click('[data-action="reset"]');
      assert.equal(await page.locator('.question-card').count(), 20);
      assert.equal(await page.inputValue('#search'), '');
    });
    await check('答案收起、单题展开与解析展开可用', async () => {
      await page.click('#toggle-answers');
      assert.equal(await page.locator('.answer-panel:visible').count(), 0);
      await card('1-1').locator('[data-action="answer"]').click();
      await card('1-1').locator('summary').click();
      assert(await card('1-1').locator('.explanation-body').isVisible());
      await cardshot('1-1', 'narrow-answer');
    });
    await check('单选错误反馈、错题重做、正确后移出列表', async () => {
      await page.click('[data-mode="practice"]');
      assert.equal(await page.locator('.correct-option').count(), 0);
      assert(await card('1-1').locator('[data-action="submit"]').isDisabled());
      await card('1-1').locator('label').filter({ has: page.locator('input[value="A"]') }).click();
      await card('1-1').locator('[data-action="submit"]').click();
      assert((await card('1-1').locator('.grading-result').innerText()).includes('回答错误'));
      assert.equal(await page.locator('#wrong-count').innerText(), '1');
      await cardshot('1-1', 'narrow-practice-wrong');
      await page.click('[data-scope="wrong"]');
      await card('1-1').locator('[data-action="retry"]').click();
      assert(await card('1-1').isVisible());
      await card('1-1').locator('label').filter({ has: page.locator('input[value="C"]') }).click();
      await card('1-1').locator('[data-action="submit"]').click();
      assert(await page.locator('.empty-state').isVisible());
      assert((await page.locator('#toast').innerText()).includes('回答正确'));
      await screenshot('narrow-correct-toast');
      assert.equal(await page.locator('#wrong-count').innerText(), '0');
    });
    await check('收藏及答题记录在刷新后恢复', async () => {
      await page.click('#reset-filters');
      await card('1-1').locator('[data-action="bookmark"]').click();
      await page.reload();
      assert.equal(await card('1-1').locator('[data-action="bookmark"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#completed-count').innerText(), '1题');
      assert.equal(await page.locator('#accuracy').innerText(), '100%');
      await page.click('[data-scope="bookmarked"]');
      assert.equal(await page.locator('.question-card').count(), 1);
      await card('1-1').locator('[data-action="bookmark"]').click();
      assert(await page.locator('.empty-state').isVisible());
    });
    await check('多选漏选判错、五选项全选判对、判断题可提交', async () => {
      await page.click('#reset-filters');
      await page.click('[data-mode="practice"]');
      await page.selectOption('#chapter-select', '7');
      await card('7-9').locator('label').first().click();
      await card('7-9').locator('[data-action="submit"]').click();
      assert.equal(await card('7-9').locator('.grading-result.incorrect').count(), 1);
      assert((await card('7-9').locator('.option-status').allTextContents()).some(text => text.includes('漏选')));
      assert(await card('7-9').locator('.option-status').evaluateAll(elements => elements.every(el => parseFloat(getComputedStyle(el).fontSize) >= 10)), '手机上必须显示正确、漏选等文字');
      await cardshot('7-9', 'narrow-multiple-missed');
      await card('7-9').locator('[data-action="retry"]').click();
      for (const label of await card('7-9').locator('label').all()) await label.click();
      await card('7-9').locator('[data-action="submit"]').click();
      assert.equal(await card('7-9').locator('.grading-result').innerText(), '回答正确');
      await page.selectOption('#chapter-select', '1');
      await page.click('[data-type="boolean"]');
      await card('1-18').locator('label').filter({ has: page.locator('input[value="×"]') }).click();
      await card('1-18').locator('[data-action="submit"]').click();
      assert.equal(await card('1-18').locator('.grading-result').innerText(), '回答正确');
      await assertLayout();
    });
    await check('分页、随机排序、键盘选择、搜索快捷键及返回顶部可用', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.click('#reset-filters');
      await page.click('#pagination [aria-label="下一页"]');
      assert.equal(await page.locator('.question-card').first().getAttribute('data-question'), '2-1');
      await page.click('#pagination [data-page="16"]');
      assert.equal(await page.locator('.question-card').count(), 3);
      await page.selectOption('#page-size', '50');
      assert.equal(await page.locator('.question-card').count(), 50);
      await page.selectOption('#sort-order', 'random');
      assert(await page.locator('#reshuffle').isVisible());
      const ids = await page.locator('.question-card').evaluateAll(cards => cards.map(c => c.dataset.question));
      assert.equal(new Set(ids).size, 50);
      await page.click('#reshuffle');
      assert.notDeepEqual(await page.locator('.question-card').evaluateAll(cards => cards.map(c => c.dataset.question)), ids);
      await page.click('#reset-filters');
      await page.click('[data-chapter="2"]');
      const first = card('2-1');
      await first.locator('input[value="A"]').focus();
      await page.keyboard.press('ArrowRight');
      assert(await first.locator('input[value="B"]').isChecked());
      assert(await first.locator('input[value="B"]').evaluate(el => el === document.activeElement));
      await page.locator('#main').focus();
      await page.keyboard.press('/');
      assert(await page.locator('#search').evaluate(el => el === document.activeElement));
      await page.keyboard.type('finfet');
      await page.keyboard.press('Escape');
      assert.equal(await page.inputValue('#search'), '');
      await page.evaluate(() => window.scrollTo(0, 1500));
      await page.locator('#back-to-top').waitFor({ state: 'visible' });
      await page.click('#back-to-top');
      await page.waitForFunction(() => scrollY === 0);
      await page.click('[data-mode="study"]');
      await page.click('#reset-filters');
      await screenshot('desktop-completed');
    });
    await check('无脚本错误、控制台错误或联网请求', async () => {
      assert.deepEqual(report.errors, []);
      assert.deepEqual(report.networkRequests, []);
    });
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.failure = error.stack;
    await screenshot('failure');
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), `${JSON.stringify(report, null, 2)}\n`);
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
