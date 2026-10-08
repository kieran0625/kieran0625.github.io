// u771fu5b9e Chrome u68c0u67e5u3002u4f9du8d56 playwright-coreuff0cu4ec5u7528u4e8eu5f00u53d1u68c0u67e5uff0cu7f51u9875u4ecdu53efu72ecu7acbu79bbu7ebfu4f7fu7528u3002
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
  // u5361u7247u7279u5199u6392u9664u60acu6d6eu63a7u4ef6uff1bu5e38u89c4u89c6u53e3u622au56feu4ecdu4fddu7559u63d0u793au548cu8fd4u56deu9876u90e8u6309u94aeu3002
  const cardshot = async (id, name) => card(id).screenshot({ path: path.join(output, `${name}.png`), style: '.skip-link,.back-to-top,#toast{visibility:hidden!important}' });
  const check = async (name, run) => { await run(); report.checks.push(name); console.log(`u2713 ${name}`); };
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
    assert.equal(result.pageWidth, result.width, `u9875u9762u5b58u5728u6a2au5411u6ea2u51fauff1a${JSON.stringify(result)}`);
    assert.deepEqual(result.overflow, [], 'u5143u7d20u8d85u51fau89c6u53e3');
    assert.deepEqual(result.clippedText, [], 'u6587u5b57u88abu88c1u5207');
    return result;
  }
  try {
    await check('u684cu9762u3001u65adu70b9u4e24u4fa7u3001u5e73u677fu53cau624bu673au5171 10 u4e2au5c3au5bf8u65e0u6a2au5411u6ea2u51fa', async () => {
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
    await check('320px u4e0bu5168u90e8 303 u9898u53cau5c55u5f00u89e3u6790u5747u65e0u6ea2u51fau6216u6587u5b57u88c1u5207', async () => {
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
    await check('u5168u90e8 15 u8bb2u53efu901au8fc7u624bu673au4e0bu62c9u7b5bu9009uff0cu957fu7ae0u8282u6807u9898u6b63u5e38u663eu793a', async () => {
      const chapters = await page.evaluate(() => window.QUESTION_BANK.chapters);
      for (const chapter of chapters) {
        await page.selectOption('#chapter-select', String(chapter.number));
        assert((await page.locator('#result-summary').innerText()).includes(`u5171 ${chapter.count} u9898`));
        await assertLayout();
      }
      await screenshot('narrow-chapter');
    });
    await check('u641cu7d22u9ad8u4eaeu3001u7ec4u5408u7b5bu9009u7a7au7ed3u679cu53cau91cdu7f6eu53efu7528', async () => {
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
    await check('u7b54u6848u6536u8d77u3001u5355u9898u5c55u5f00u4e0eu89e3u6790u5c55u5f00u53efu7528', async () => {
      await page.click('#toggle-answers');
      assert.equal(await page.locator('.answer-panel:visible').count(), 0);
      await card('1-1').locator('[data-action="answer"]').click();
      await card('1-1').locator('summary').click();
      assert(await card('1-1').locator('.explanation-body').isVisible());
      await cardshot('1-1', 'narrow-answer');
    });
    await check('u5355u9009u9519u8befu53cdu9988u3001u9519u9898u91cdu505au3001u6b63u786eu540eu79fbu51fau5217u8868', async () => {
      await page.click('[data-mode="practice"]');
      assert.equal(await page.locator('.correct-option').count(), 0);
      assert(await card('1-1').locator('[data-action="submit"]').isDisabled());
      await card('1-1').locator('label').filter({ has: page.locator('input[value="A"]') }).click();
      await card('1-1').locator('[data-action="submit"]').click();
      assert((await card('1-1').locator('.grading-result').innerText()).includes('u56deu7b54u9519u8bef'));
      assert.equal(await page.locator('#wrong-count').innerText(), '1');
      await cardshot('1-1', 'narrow-practice-wrong');
      await page.click('[data-scope="wrong"]');
      await card('1-1').locator('[data-action="retry"]').click();
      assert(await card('1-1').isVisible());
      await card('1-1').locator('label').filter({ has: page.locator('input[value="C"]') }).click();
      await card('1-1').locator('[data-action="submit"]').click();
      assert(await page.locator('.empty-state').isVisible());
      assert((await page.locator('#toast').innerText()).includes('u56deu7b54u6b63u786e'));
      await screenshot('narrow-correct-toast');
      assert.equal(await page.locator('#wrong-count').innerText(), '0');
    });
    await check('u6536u85cfu53cau7b54u9898u8bb0u5f55u5728u5237u65b0u540eu6062u590d', async () => {
      await page.click('#reset-filters');
      await card('1-1').locator('[data-action="bookmark"]').click();
      await page.reload();
      assert.equal(await card('1-1').locator('[data-action="bookmark"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#completed-count').innerText(), '1u9898');
      assert.equal(await page.locator('#accuracy').innerText(), '100%');
      await page.click('[data-scope="bookmarked"]');
      assert.equal(await page.locator('.question-card').count(), 1);
      await card('1-1').locator('[data-action="bookmark"]').click();
      assert(await page.locator('.empty-state').isVisible());
    });
    await check('u591au9009u6f0fu9009u5224u9519u3001u4e94u9009u9879u5168u9009u5224u5bf9u3001u5224u65adu9898u53efu63d0u4ea4', async () => {
      await page.click('#reset-filters');
      await page.click('[data-mode="practice"]');
      await page.selectOption('#chapter-select', '7');
      await card('7-9').locator('label').first().click();
      await card('7-9').locator('[data-action="submit"]').click();
      assert.equal(await card('7-9').locator('.grading-result.incorrect').count(), 1);
      assert((await card('7-9').locator('.option-status').allTextContents()).some(text => text.includes('u6f0fu9009')));
      assert(await card('7-9').locator('.option-status').evaluateAll(elements => elements.every(el => parseFloat(getComputedStyle(el).fontSize) >= 10)), 'u624bu673au4e0au5fc5u987bu663eu793au6b63u786eu3001u6f0fu9009u7b49u6587u5b57');
      await cardshot('7-9', 'narrow-multiple-missed');
      await card('7-9').locator('[data-action="retry"]').click();
      for (const label of await card('7-9').locator('label').all()) await label.click();
      await card('7-9').locator('[data-action="submit"]').click();
      assert.equal(await card('7-9').locator('.grading-result').innerText(), 'u56deu7b54u6b63u786e');
      await page.selectOption('#chapter-select', '1');
      await page.click('[data-type="boolean"]');
      await card('1-18').locator('label').filter({ has: page.locator('input[value="u00d7"]') }).click();
      await card('1-18').locator('[data-action="submit"]').click();
      assert.equal(await card('1-18').locator('.grading-result').innerText(), 'u56deu7b54u6b63u786e');
      await assertLayout();
    });
    await check('u5206u9875u3001u968fu673au6392u5e8fu3001u952eu76d8u9009u62e9u3001u641cu7d22u5febu6377u952eu53cau8fd4u56deu9876u90e8u53efu7528', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.click('#reset-filters');
      await page.click('#pagination [aria-label="u4e0bu4e00u9875"]');
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
    await check('u65e0u811au672cu9519u8befu3001u63a7u5236u53f0u9519u8befu6216u8054u7f51u8bf7u6c42', async () => {
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
