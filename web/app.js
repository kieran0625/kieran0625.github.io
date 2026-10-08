(() => {
  'use strict';
  const { chapters, questions } = window.QUESTION_BANK;
  const byId = new Map(questions.map(question => [question.id, question]));
  const labels = { single: '单选题', multiple: '多选题', boolean: '判断题' };
  const storageKey = 'engineering-ethics-progress-v1';
  const $ = selector => document.querySelector(selector);
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const sameAnswer = (a, b) => a.length === b.length && a.every(key => b.includes(key));
  const state = { chapter: 0, type: 'all', scope: 'all', query: '', mode: 'study', showAnswers: true, page: 1, pageSize: 20, order: 'original' };
  const answerVisibility = new Map();
  const openExplanations = new Set();
  const drafts = new Map();
  let bookmarks = new Set(), attempts = {}, randomRanks = new Map(), toastTimer, storageAvailable = true;

  // 损坏或旧版本的本地记录不会阻止题库打开。
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (Array.isArray(saved?.bookmarks)) bookmarks = new Set(saved.bookmarks.filter(id => byId.has(id)));
    if (saved?.attempts && typeof saved.attempts === 'object') {
      for (const [id, record] of Object.entries(saved.attempts)) {
        const question = byId.get(id);
        if (!question || !Array.isArray(record?.selected)) continue;
        const selected = [...new Set(record.selected)].filter(key => question.options.some(option => option.key === key));
        if (!selected.length || (question.type !== 'multiple' && selected.length !== 1)) continue;
        attempts[id] = { selected, correct: sameAnswer(selected, question.answer) };
      }
    }
  } catch { storageAvailable = false; }

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ bookmarks: [...bookmarks], attempts }));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
      toast('浏览器无法保存记录，本次打开期间仍可正常练习。');
    }
    updateSaveLabel();
  }
  function updateSaveLabel() {
    $('#save-label').textContent = storageAvailable ? '学习记录保存在本机' : '当前记录仅在本次打开中保留';
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('#toast').textContent = message;
    $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 2600);
  }

  function highlight(value) {
    const query = state.query.trim();
    if (!query) return escapeHTML(value);
    const terms = query.split(/\s+/).filter(Boolean).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`(${terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return String(value).split(pattern).map((part, index) => index % 2 ? `<mark>${escapeHTML(part)}</mark>` : escapeHTML(part)).join('');
  }
  function markdown(value) {
    // 原资料仅用到加粗和段落；先转义，避免把资料内容当作 HTML 执行。
    return value.split(/\n\s*\n/).map(paragraph => `<p>${escapeHTML(paragraph).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`).join('');
  }
  const searchText = new Map(questions.map(question => [question.id, [
    question.stem, ...question.options.map(option => option.text),
    `第${question.chapter}讲`, chapters[question.chapter - 1].title
  ].join(' ').toLocaleLowerCase()]));

  function matches(question, ignoreType = false) {
    if (state.chapter && question.chapter !== state.chapter) return false;
    if (!ignoreType && state.type !== 'all' && question.type !== state.type) return false;
    if (state.scope === 'bookmarked' && !bookmarks.has(question.id)) return false;
    if (state.scope === 'wrong' && attempts[question.id]?.correct !== false) return false;
    if (state.scope === 'unanswered' && attempts[question.id]) return false;
    if (state.scope === 'noted' && !question.note) return false;
    const terms = state.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return terms.every(term => searchText.get(question.id).includes(term));
  }
  function filteredQuestions() {
    const result = questions.filter(question => matches(question));
    if (state.order === 'random') result.sort((a, b) => randomRanks.get(a.id) - randomRanks.get(b.id));
    return result;
  }
  function shuffle() {
    const ids = questions.map(question => question.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    randomRanks = new Map(ids.map((id, index) => [id, index]));
  }
  function isRevealed(question) {
    if (state.mode === 'practice' && attempts[question.id] && !drafts.has(question.id)) return true;
    return answerVisibility.has(question.id) ? answerVisibility.get(question.id) : state.showAnswers;
  }
  function updateStats() {
    const records = Object.values(attempts);
    const right = records.filter(record => record.correct).length;
    $('#completed-count').innerHTML = `${records.length}<span>题</span>`;
    $('#accuracy').innerHTML = records.length ? `${Math.round(right / records.length * 100)}<span>%</span>` : '—';
    $('#wrong-count').textContent = records.length - right;
    $('#bookmark-count').textContent = bookmarks.size;
    updateSaveLabel();
  }

  function renderChapters() {
    $('#chapter-nav').innerHTML = `<button type="button" class="chapter-button all-chapters" data-chapter="0" aria-pressed="${state.chapter === 0}">${icon('grid')}<span class="chapter-title">全部章节</span><span class="chapter-count">303</span></button>` + chapters.map(chapter => `<button type="button" class="chapter-button" data-chapter="${chapter.number}" aria-pressed="${state.chapter === chapter.number}"><span class="chapter-number">${String(chapter.number).padStart(2, '0')}</span><span class="chapter-title">${escapeHTML(chapter.title)}</span><span class="chapter-count">${chapter.count}</span></button>`).join('');
    $('#chapter-select').innerHTML = '<option value="0">全部章节 · 303 题</option>' + chapters.map(chapter => `<option value="${chapter.number}">第 ${chapter.number} 讲 · ${escapeHTML(chapter.title)}（${chapter.count} 题）</option>`).join('');
    $('#chapter-select').value = state.chapter;
  }
  function renderFilters() {
    const candidates = questions.filter(question => matches(question, true));
    $('#type-filters').innerHTML = [['all', '全部'], ...Object.entries(labels)].map(([type, label]) => `<button type="button" data-type="${type}" aria-pressed="${state.type === type}">${label}<span>${type === 'all' ? candidates.length : candidates.filter(question => question.type === type).length}</span></button>`).join('');
    document.querySelectorAll('[data-scope]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === state.scope)));
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('#toggle-answers').hidden = state.mode === 'practice';
    $('#toggle-answers').textContent = state.showAnswers ? '隐藏全部答案' : '显示全部答案';
    $('#reshuffle').hidden = state.order !== 'random';
    $('#mode-help').textContent = state.mode === 'practice'
      ? '选择选项后提交答案；多选题需全部选对。练习与收藏记录自动保存在本机。'
      : state.showAnswers ? '答案已展开，点击「查看解析」理解解题思路。' : '答案已隐藏，可以逐题查看，也可以一键显示全部答案。';
  }

  function renderCard(question) {
    const practice = state.mode === 'practice';
    const revealed = isRevealed(question);
    const record = drafts.has(question.id) ? null : attempts[question.id];
    const selected = drafts.get(question.id) || record?.selected || [];
    const locked = practice && Boolean(record);
    const chapter = chapters[question.chapter - 1];
    const optionHTML = question.options.map(option => {
      const correct = revealed && question.answer.includes(option.key);
      const chosen = practice && selected.includes(option.key);
      const wrong = practice && record && chosen && !question.answer.includes(option.key);
      const classes = ['option', practice && 'practice-option', correct && 'correct-option', chosen && !revealed && 'selected-option', wrong && 'wrong-option'].filter(Boolean).join(' ');
      const input = practice ? `<input type="${question.type === 'multiple' ? 'checkbox' : 'radio'}" name="answer-${question.id}" value="${option.key}" data-option="${question.id}" ${chosen ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="${escapeHTML(`${option.key} ${option.text}`)}">` : '';
      const status = wrong ? `${icon('close')}选错` : correct ? `${icon('check')}${practice && record && !chosen ? '漏选' : '正确'}` : '';
      const tag = practice ? 'label' : 'div';
      return `<${tag} class="${classes}">${input}<span class="option-key">${option.key}</span><span class="option-text">${highlight(option.text)}</span>${status ? `<span class="option-status">${status}</span>` : ''}</${tag}>`;
    }).join('');
    const badge = question.type === 'boolean' ? (question.answer[0] === '√' ? '√ 正确' : '× 错误') : question.answer.join('');
    let footer;
    if (practice) {
      footer = `<div class="practice-actions">${record ? `<span class="grading-result ${record.correct ? '' : 'incorrect'}">${record.correct ? '回答正确' : `回答错误 · 你的答案 ${escapeHTML(record.selected.join(''))}`}</span><button type="button" class="text-button" data-action="retry" data-id="${question.id}">${icon('refresh')}重新练习</button>` : `<button type="button" class="primary-button" data-action="submit" data-id="${question.id}" ${selected.length ? '' : 'disabled'}>提交答案</button><span class="answer-hint">${question.type === 'multiple' ? '可选择多个选项' : '请选择一个选项'}</span>`}</div>${record ? '' : `<button type="button" class="text-button" data-action="answer" data-id="${question.id}" aria-expanded="${revealed}" aria-controls="answer-${question.id}">${revealed ? '隐藏答案' : '查看答案'}</button>`}`;
    } else {
      footer = `<span class="answer-hint">${question.type === 'multiple' ? '多选题 · 多个正确选项' : question.type === 'boolean' ? '判断题 · 判断正误' : '单选题 · 一个正确选项'}</span><button type="button" class="text-button" data-action="answer" data-id="${question.id}" aria-expanded="${revealed}" aria-controls="answer-${question.id}">${revealed ? '收起答案' : '查看答案'}${icon('arrow')}</button>`;
    }
    return `<article class="question-card" data-question="${question.id}" aria-labelledby="stem-${question.id}">
      <div class="question-meta"><span class="question-index">${String(question.chapter).padStart(2, '0')} / ${String(question.number).padStart(2, '0')}</span><span class="type-badge type-${question.type}">${labels[question.type]}</span><span class="meta-dot">·</span><span class="question-chapter" title="第 ${question.chapter} 讲 ${escapeHTML(chapter.title)}">第 ${question.chapter} 讲 · ${escapeHTML(chapter.title)}</span><button type="button" class="icon-button bookmark-button" data-action="bookmark" data-id="${question.id}" aria-pressed="${bookmarks.has(question.id)}" aria-label="${bookmarks.has(question.id) ? '取消收藏' : '收藏'}第 ${question.chapter} 讲第 ${question.number} 题" title="${bookmarks.has(question.id) ? '取消收藏' : '收藏题目'}">${icon('star')}</button></div>
      <h3 id="stem-${question.id}">${highlight(question.stem)}</h3>
      <fieldset class="question-options"><legend class="sr-only">第 ${question.chapter} 讲第 ${question.number} 题的选项</legend>${optionHTML}</fieldset>
      ${question.note && (revealed || question.id === '8-15') ? `<div class="source-note">${icon('info')}<span>${escapeHTML(question.note)}</span></div>` : question.note ? '<div class="answer-hint">本题有资料提示，查看答案后显示。</div>' : ''}
      <div class="answer-panel" id="answer-${question.id}" ${revealed ? '' : 'hidden'}><div class="answer-summary"><span>参考答案</span><strong>${badge}</strong></div><details class="explanation" data-explanation="${question.id}" ${openExplanations.has(question.id) ? 'open' : ''}><summary>${icon('arrow')}查看解析</summary><div class="explanation-body">${markdown(question.explanation)}</div></details></div>
      <div class="question-footer">${footer}</div>
    </article>`;
  }

  function renderPagination(total) {
    const pages = Math.max(1, Math.ceil(total / state.pageSize));
    const visible = new Set([1, pages, state.page - 1, state.page, state.page + 1]);
    if (state.page <= 2) visible.add(3);
    if (state.page >= pages - 1) visible.add(pages - 2);
    let previous = 0;
    const buttons = [...visible].filter(page => page >= 1 && page <= pages).sort((a, b) => a - b).map(page => {
      const gap = page - previous > 1 ? '<span class="answer-hint">…</span>' : '';
      previous = page;
      return `${gap}<button type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ''} aria-label="第 ${page} 页">${page}</button>`;
    }).join('');
    $('#pagination').innerHTML = total ? `<button type="button" class="page-prev" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="上一页">${icon('arrow')}</button>${buttons}<button type="button" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="下一页">${icon('arrow')}</button><label class="page-size-label" for="page-size">每页<select id="page-size"><option value="20">20 题</option><option value="50">50 题</option><option value="303">全部</option></select></label>` : '';
    if ($('#page-size')) $('#page-size').value = state.pageSize;
  }
  function renderQuestions() {
    const result = filteredQuestions();
    state.page = Math.max(1, Math.min(state.page, Math.ceil(result.length / state.pageSize) || 1));
    const start = (state.page - 1) * state.pageSize;
    const visible = result.slice(start, start + state.pageSize);
    const scopeNames = { all: '全部题目', unanswered: '未练习', wrong: '我的错题', bookmarked: '我的收藏', noted: '资料提示' };
    $('#results-title').textContent = state.chapter ? `第 ${state.chapter} 讲 · ${chapters[state.chapter - 1].title}` : scopeNames[state.scope];
    $('#result-summary').textContent = result.length ? `共 ${result.length} 题 · 当前 ${start + 1}–${start + visible.length}` : '共 0 题';
    $('#question-list').innerHTML = result.length ? visible.map(renderCard).join('') : `<div class="empty-state">${icon('search')}<h3>没有符合条件的题目</h3><p>${state.scope === 'bookmarked' ? '点击题目右上角的星标，将想复习的题目收藏到这里。' : state.scope === 'wrong' ? '这里显示最近一次练习答错的题目，答对后会自动移出。' : '试试其他关键词，或调整章节、题型和范围。'}</p><button type="button" class="primary-button" data-action="reset">查看全部题目</button></div>`;
    renderPagination(result.length);
  }
  function render() { updateStats(); renderChapters(); renderFilters(); renderQuestions(); }
  function refreshCard(id, focusSelector) {
    const element = document.querySelector(`[data-question="${id}"]`);
    if (!element) return;
    element.outerHTML = renderCard(byId.get(id));
    if (focusSelector) document.querySelector(`[data-question="${id}"] ${focusSelector}`)?.focus({ preventScroll: true });
  }
  function scrollToResults() {
    $('#results-toolbar').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }
  function changeFilter(key, value) {
    state[key] = value;
    state.page = 1;
    render();
  }
  function resetFilters() {
    Object.assign(state, { chapter: 0, type: 'all', scope: 'all', query: '', page: 1, order: 'original' });
    $('#search').value = '';
    $('#sort-order').value = 'original';
    render();
  }

  $('#chapter-nav').addEventListener('click', event => {
    const button = event.target.closest('[data-chapter]');
    if (!button) return;
    changeFilter('chapter', Number(button.dataset.chapter));
    document.querySelector(`[data-chapter="${state.chapter}"]`)?.focus({ preventScroll: true });
    scrollToResults();
  });
  $('#chapter-select').addEventListener('change', event => changeFilter('chapter', Number(event.target.value)));
  $('#type-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-type]');
    if (!button) return;
    changeFilter('type', button.dataset.type);
    document.querySelector(`[data-type="${state.type}"]`)?.focus({ preventScroll: true });
  });
  $('#scope-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-scope]');
    if (button) changeFilter('scope', button.dataset.scope);
  });
  $('#search').addEventListener('input', event => changeFilter('query', event.target.value));
  $('#reset-filters').addEventListener('click', resetFilters);
  $('.brand').addEventListener('click', event => { event.preventDefault(); resetFilters(); window.scrollTo({ top: 0 }); });
  $('.mode-control').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (!button || state.mode === button.dataset.mode) return;
    state.mode = button.dataset.mode;
    state.showAnswers = state.mode === 'study';
    answerVisibility.clear();
    openExplanations.clear();
    renderFilters();
    renderQuestions();
  });
  $('#toggle-answers').addEventListener('click', () => {
    state.showAnswers = !state.showAnswers;
    answerVisibility.clear();
    renderFilters();
    renderQuestions();
  });
  $('#sort-order').addEventListener('change', event => {
    if (event.target.value === 'random') shuffle();
    changeFilter('order', event.target.value);
  });
  $('#reshuffle').addEventListener('click', () => { shuffle(); state.page = 1; renderQuestions(); toast('题目顺序已重新打乱'); });
  $('#pagination').addEventListener('click', event => {
    const button = event.target.closest('[data-page]');
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    renderQuestions();
    scrollToResults();
  });
  $('#pagination').addEventListener('change', event => {
    if (event.target.id !== 'page-size') return;
    state.pageSize = Number(event.target.value);
    state.page = 1;
    renderQuestions();
    scrollToResults();
  });
  $('#question-list').addEventListener('toggle', event => {
    const id = event.target.dataset.explanation;
    if (!id) return;
    event.target.open ? openExplanations.add(id) : openExplanations.delete(id);
  }, true);
  $('#question-list').addEventListener('change', event => {
    const id = event.target.dataset.option;
    if (!id) return;
    const question = byId.get(id);
    const selected = new Set(drafts.get(id) || []);
    if (question.type !== 'multiple') selected.clear();
    event.target.checked ? selected.add(event.target.value) : selected.delete(event.target.value);
    drafts.set(id, [...selected]);
    // 保留真实输入节点，键盘方向键和多选焦点不因重绘丢失。
    const card = event.target.closest('.question-card');
    card.querySelectorAll('input[data-option]').forEach(input => {
      input.closest('.option').classList.toggle('selected-option', input.checked && !isRevealed(question));
    });
    card.querySelector('[data-action="submit"]').disabled = selected.size === 0;
  });
  $('#question-list').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'reset') { resetFilters(); return; }
    const question = byId.get(id);
    if (!question) return;
    if (action === 'bookmark') {
      bookmarks.has(id) ? bookmarks.delete(id) : bookmarks.add(id);
      persist();
      updateStats();
      renderFilters();
      if (state.scope === 'bookmarked') renderQuestions();
      else refreshCard(id, '[data-action="bookmark"]');
    }
    if (action === 'answer') {
      answerVisibility.set(id, !isRevealed(question));
      refreshCard(id, '[data-action="answer"]');
    }
    if (action === 'submit') {
      const selected = drafts.get(id);
      if (!selected?.length) return;
      const correct = sameAnswer(selected, question.answer);
      attempts[id] = { selected: [...selected], correct };
      drafts.delete(id);
      answerVisibility.set(id, true);
      persist();
      updateStats();
      renderFilters();
      // 即时更新动态筛选；toast 在题目移出未练习/错题列表后仍给出判定。
      if (!matches(question)) {
        toast(`${correct ? '回答正确' : '回答错误'}，参考答案：${question.answer.join('')}。题目已移出当前列表。`);
        renderQuestions();
      } else {
        refreshCard(id, '[data-action="retry"]');
        toast(correct ? '回答正确' : `回答错误，参考答案：${question.answer.join('')}`);
      }
    }
    if (action === 'retry') {
      // 重做期间保留上次成绩，下一次提交后再更新错题和统计。
      drafts.set(id, []);
      answerVisibility.set(id, false);
      openExplanations.delete(id);
      refreshCard(id, 'input[data-option]');
    }
  });
  document.addEventListener('keydown', event => {
    const editing = /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) || event.target.isContentEditable;
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); $('#search').focus(); }
    if (event.key === 'Escape' && event.target === $('#search')) { $('#search').value = ''; changeFilter('query', ''); }
  });
  window.addEventListener('scroll', () => { $('#back-to-top').hidden = window.scrollY < 500; }, { passive: true });
  $('#back-to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  render();
})();
