(() => {
  'use strict';
  const { chapters, questions } = window.QUESTION_BANK;
  const byId = new Map(questions.map(question => [question.id, question]));
  const labels = { single: 'u5355u9009u9898', multiple: 'u591au9009u9898', boolean: 'u5224u65adu9898' };
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

  // u635fu574fu6216u65e7u7248u672cu7684u672cu5730u8bb0u5f55u4e0du4f1au963bu6b62u9898u5e93u6253u5f00u3002
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
      toast('u6d4fu89c8u5668u65e0u6cd5u4fddu5b58u8bb0u5f55uff0cu672cu6b21u6253u5f00u671fu95f4u4ecdu53efu6b63u5e38u7ec3u4e60u3002');
    }
    updateSaveLabel();
  }
  function updateSaveLabel() {
    $('#save-label').textContent = storageAvailable ? 'u5b66u4e60u8bb0u5f55u4fddu5b58u5728u672cu673a' : 'u5f53u524du8bb0u5f55u4ec5u5728u672cu6b21u6253u5f00u4e2du4fddu7559';
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
    // u539fu8d44u6599u4ec5u7528u5230u52a0u7c97u548cu6bb5u843duff1bu5148u8f6cu4e49uff0cu907fu514du628au8d44u6599u5185u5bb9u5f53u4f5c HTML u6267u884cu3002
    return value.split(/\n\s*\n/).map(paragraph => `<p>${escapeHTML(paragraph).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`).join('');
  }
  const searchText = new Map(questions.map(question => [question.id, [
    question.stem, ...question.options.map(option => option.text),
    `u7b2c${question.chapter}u8bb2`, chapters[question.chapter - 1].title
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
    $('#completed-count').innerHTML = `${records.length}<span>u9898</span>`;
    $('#accuracy').innerHTML = records.length ? `${Math.round(right / records.length * 100)}<span>%</span>` : 'u2014';
    $('#wrong-count').textContent = records.length - right;
    $('#bookmark-count').textContent = bookmarks.size;
    updateSaveLabel();
  }

  function renderChapters() {
    $('#chapter-nav').innerHTML = `<button type="button" class="chapter-button all-chapters" data-chapter="0" aria-pressed="${state.chapter === 0}">${icon('grid')}<span class="chapter-title">u5168u90e8u7ae0u8282</span><span class="chapter-count">303</span></button>` + chapters.map(chapter => `<button type="button" class="chapter-button" data-chapter="${chapter.number}" aria-pressed="${state.chapter === chapter.number}"><span class="chapter-number">${String(chapter.number).padStart(2, '0')}</span><span class="chapter-title">${escapeHTML(chapter.title)}</span><span class="chapter-count">${chapter.count}</span></button>`).join('');
    $('#chapter-select').innerHTML = '<option value="0">u5168u90e8u7ae0u8282 u00b7 303 u9898</option>' + chapters.map(chapter => `<option value="${chapter.number}">u7b2c ${chapter.number} u8bb2 u00b7 ${escapeHTML(chapter.title)}uff08${chapter.count} u9898uff09</option>`).join('');
    $('#chapter-select').value = state.chapter;
  }
  function renderFilters() {
    const candidates = questions.filter(question => matches(question, true));
    $('#type-filters').innerHTML = [['all', 'u5168u90e8'], ...Object.entries(labels)].map(([type, label]) => `<button type="button" data-type="${type}" aria-pressed="${state.type === type}">${label}<span>${type === 'all' ? candidates.length : candidates.filter(question => question.type === type).length}</span></button>`).join('');
    document.querySelectorAll('[data-scope]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.scope === state.scope)));
    document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
    $('#toggle-answers').hidden = state.mode === 'practice';
    $('#toggle-answers').textContent = state.showAnswers ? 'u9690u85cfu5168u90e8u7b54u6848' : 'u663eu793au5168u90e8u7b54u6848';
    $('#reshuffle').hidden = state.order !== 'random';
    $('#mode-help').textContent = state.mode === 'practice'
      ? 'u9009u62e9u9009u9879u540eu63d0u4ea4u7b54u6848uff1bu591au9009u9898u9700u5168u90e8u9009u5bf9u3002u7ec3u4e60u4e0eu6536u85cfu8bb0u5f55u81eau52a8u4fddu5b58u5728u672cu673au3002'
      : state.showAnswers ? 'u7b54u6848u5df2u5c55u5f00uff0cu70b9u51fbu300cu67e5u770bu89e3u6790u300du7406u89e3u89e3u9898u601du8defu3002' : 'u7b54u6848u5df2u9690u85cfuff0cu53efu4ee5u9010u9898u67e5u770buff0cu4e5fu53efu4ee5u4e00u952eu663eu793au5168u90e8u7b54u6848u3002';
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
      const status = wrong ? `${icon('close')}u9009u9519` : correct ? `${icon('check')}${practice && record && !chosen ? 'u6f0fu9009' : 'u6b63u786e'}` : '';
      const tag = practice ? 'label' : 'div';
      return `<${tag} class="${classes}">${input}<span class="option-key">${option.key}</span><span class="option-text">${highlight(option.text)}</span>${status ? `<span class="option-status">${status}</span>` : ''}</${tag}>`;
    }).join('');
    const badge = question.type === 'boolean' ? (question.answer[0] === 'u221a' ? 'u221a u6b63u786e' : 'u00d7 u9519u8bef') : question.answer.join('');
    let footer;
    if (practice) {
      footer = `<div class="practice-actions">${record ? `<span class="grading-result ${record.correct ? '' : 'incorrect'}">${record.correct ? 'u56deu7b54u6b63u786e' : `u56deu7b54u9519u8bef u00b7 u4f60u7684u7b54u6848 ${escapeHTML(record.selected.join(''))}`}</span><button type="button" class="text-button" data-action="retry" data-id="${question.id}">${icon('refresh')}u91cdu65b0u7ec3u4e60</button>` : `<button type="button" class="primary-button" data-action="submit" data-id="${question.id}" ${selected.length ? '' : 'disabled'}>u63d0u4ea4u7b54u6848</button><span class="answer-hint">${question.type === 'multiple' ? 'u53efu9009u62e9u591au4e2au9009u9879' : 'u8bf7u9009u62e9u4e00u4e2au9009u9879'}</span>`}</div>${record ? '' : `<button type="button" class="text-button" data-action="answer" data-id="${question.id}" aria-expanded="${revealed}" aria-controls="answer-${question.id}">${revealed ? 'u9690u85cfu7b54u6848' : 'u67e5u770bu7b54u6848'}</button>`}`;
    } else {
      footer = `<span class="answer-hint">${question.type === 'multiple' ? 'u591au9009u9898 u00b7 u591au4e2au6b63u786eu9009u9879' : question.type === 'boolean' ? 'u5224u65adu9898 u00b7 u5224u65adu6b63u8bef' : 'u5355u9009u9898 u00b7 u4e00u4e2au6b63u786eu9009u9879'}</span><button type="button" class="text-button" data-action="answer" data-id="${question.id}" aria-expanded="${revealed}" aria-controls="answer-${question.id}">${revealed ? 'u6536u8d77u7b54u6848' : 'u67e5u770bu7b54u6848'}${icon('arrow')}</button>`;
    }
    return `<article class="question-card" data-question="${question.id}" aria-labelledby="stem-${question.id}">
      <div class="question-meta"><span class="question-index">${String(question.chapter).padStart(2, '0')} / ${String(question.number).padStart(2, '0')}</span><span class="type-badge type-${question.type}">${labels[question.type]}</span><span class="meta-dot">u00b7</span><span class="question-chapter" title="u7b2c ${question.chapter} u8bb2 ${escapeHTML(chapter.title)}">u7b2c ${question.chapter} u8bb2 u00b7 ${escapeHTML(chapter.title)}</span><button type="button" class="icon-button bookmark-button" data-action="bookmark" data-id="${question.id}" aria-pressed="${bookmarks.has(question.id)}" aria-label="${bookmarks.has(question.id) ? 'u53d6u6d88u6536u85cf' : 'u6536u85cf'}u7b2c ${question.chapter} u8bb2u7b2c ${question.number} u9898" title="${bookmarks.has(question.id) ? 'u53d6u6d88u6536u85cf' : 'u6536u85cfu9898u76ee'}">${icon('star')}</button></div>
      <h3 id="stem-${question.id}">${highlight(question.stem)}</h3>
      <fieldset class="question-options"><legend class="sr-only">u7b2c ${question.chapter} u8bb2u7b2c ${question.number} u9898u7684u9009u9879</legend>${optionHTML}</fieldset>
      ${question.note && (revealed || question.id === '8-15') ? `<div class="source-note">${icon('info')}<span>${escapeHTML(question.note)}</span></div>` : question.note ? '<div class="answer-hint">u672cu9898u6709u8d44u6599u63d0u793auff0cu67e5u770bu7b54u6848u540eu663eu793au3002</div>' : ''}
      <div class="answer-panel" id="answer-${question.id}" ${revealed ? '' : 'hidden'}><div class="answer-summary"><span>u53c2u8003u7b54u6848</span><strong>${badge}</strong></div><details class="explanation" data-explanation="${question.id}" ${openExplanations.has(question.id) ? 'open' : ''}><summary>${icon('arrow')}u67e5u770bu89e3u6790</summary><div class="explanation-body">${markdown(question.explanation)}</div></details></div>
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
      const gap = page - previous > 1 ? '<span class="answer-hint">u2026</span>' : '';
      previous = page;
      return `${gap}<button type="button" data-page="${page}" ${page === state.page ? 'aria-current="page"' : ''} aria-label="u7b2c ${page} u9875">${page}</button>`;
    }).join('');
    $('#pagination').innerHTML = total ? `<button type="button" class="page-prev" data-page="${state.page - 1}" ${state.page === 1 ? 'disabled' : ''} aria-label="u4e0au4e00u9875">${icon('arrow')}</button>${buttons}<button type="button" data-page="${state.page + 1}" ${state.page === pages ? 'disabled' : ''} aria-label="u4e0bu4e00u9875">${icon('arrow')}</button><label class="page-size-label" for="page-size">u6bcfu9875<select id="page-size"><option value="20">20 u9898</option><option value="50">50 u9898</option><option value="303">u5168u90e8</option></select></label>` : '';
    if ($('#page-size')) $('#page-size').value = state.pageSize;
  }
  function renderQuestions() {
    const result = filteredQuestions();
    state.page = Math.max(1, Math.min(state.page, Math.ceil(result.length / state.pageSize) || 1));
    const start = (state.page - 1) * state.pageSize;
    const visible = result.slice(start, start + state.pageSize);
    const scopeNames = { all: 'u5168u90e8u9898u76ee', unanswered: 'u672au7ec3u4e60', wrong: 'u6211u7684u9519u9898', bookmarked: 'u6211u7684u6536u85cf', noted: 'u8d44u6599u63d0u793a' };
    $('#results-title').textContent = state.chapter ? `u7b2c ${state.chapter} u8bb2 u00b7 ${chapters[state.chapter - 1].title}` : scopeNames[state.scope];
    $('#result-summary').textContent = result.length ? `u5171 ${result.length} u9898 u00b7 u5f53u524d ${start + 1}u2013${start + visible.length}` : 'u5171 0 u9898';
    $('#question-list').innerHTML = result.length ? visible.map(renderCard).join('') : `<div class="empty-state">${icon('search')}<h3>u6ca1u6709u7b26u5408u6761u4ef6u7684u9898u76ee</h3><p>${state.scope === 'bookmarked' ? 'u70b9u51fbu9898u76eeu53f3u4e0au89d2u7684u661fu6807uff0cu5c06u60f3u590du4e60u7684u9898u76eeu6536u85cfu5230u8fd9u91ccu3002' : state.scope === 'wrong' ? 'u8fd9u91ccu663eu793au6700u8fd1u4e00u6b21u7ec3u4e60u7b54u9519u7684u9898u76eeuff0cu7b54u5bf9u540eu4f1au81eau52a8u79fbu51fau3002' : 'u8bd5u8bd5u5176u4ed6u5173u952eu8bcduff0cu6216u8c03u6574u7ae0u8282u3001u9898u578bu548cu8303u56f4u3002'}</p><button type="button" class="primary-button" data-action="reset">u67e5u770bu5168u90e8u9898u76ee</button></div>`;
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
  $('#reshuffle').addEventListener('click', () => { shuffle(); state.page = 1; renderQuestions(); toast('u9898u76eeu987au5e8fu5df2u91cdu65b0u6253u4e71'); });
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
    // u4fddu7559u771fu5b9eu8f93u5165u8282u70b9uff0cu952eu76d8u65b9u5411u952eu548cu591au9009u7126u70b9u4e0du56e0u91cdu7ed8u4e22u5931u3002
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
      // u5373u65f6u66f4u65b0u52a8u6001u7b5bu9009uff1btoast u5728u9898u76eeu79fbu51fau672au7ec3u4e60/u9519u9898u5217u8868u540eu4ecdu7ed9u51fau5224u5b9au3002
      if (!matches(question)) {
        toast(`${correct ? 'u56deu7b54u6b63u786e' : 'u56deu7b54u9519u8bef'}uff0cu53c2u8003u7b54u6848uff1a${question.answer.join('')}u3002u9898u76eeu5df2u79fbu51fau5f53u524du5217u8868u3002`);
        renderQuestions();
      } else {
        refreshCard(id, '[data-action="retry"]');
        toast(correct ? 'u56deu7b54u6b63u786e' : `u56deu7b54u9519u8befuff0cu53c2u8003u7b54u6848uff1a${question.answer.join('')}`);
      }
    }
    if (action === 'retry') {
      // u91cdu505au671fu95f4u4fddu7559u4e0au6b21u6210u7ee9uff0cu4e0bu4e00u6b21u63d0u4ea4u540eu518du66f4u65b0u9519u9898u548cu7edfu8ba1u3002
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
