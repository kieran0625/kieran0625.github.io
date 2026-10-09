(() => {
  'use strict';
  const root = document.documentElement;
  const languageButton = document.querySelector('#language-toggle');
  const themeButton = document.querySelector('#theme-toggle');
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const keys = { language: 'kieran-homepage-language', theme: 'kieran-homepage-theme' };
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const save = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Preferences also work without storage. */ } };
  let language = read(keys.language) === 'en' ? 'en' : 'zh';
  let storedTheme = read(keys.theme);
  let manualTheme = storedTheme === 'dark' || storedTheme === 'light';
  let theme = manualTheme ? storedTheme : systemTheme.matches ? 'dark' : 'light';

  function updateThemeButton() {
    themeButton.setAttribute('aria-pressed', String(theme === 'dark'));
    const label = language === 'zh'
      ? theme === 'dark' ? '切换浅色模式' : '切换深色模式'
      : theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    themeButton.setAttribute('aria-label', label);
    themeButton.title = label;
  }

  function applyTheme() {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#10151d' : '#fbfaf7';
    updateThemeButton();
  }

  function applyLanguage() {
    root.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-zh][data-en]').forEach(element => {
      element.textContent = element.getAttribute('data-' + language);
    });
    document.querySelectorAll('[data-aria-zh][data-aria-en]').forEach(element => {
      element.setAttribute('aria-label', element.getAttribute('data-aria-' + language));
    });
    document.querySelectorAll('[data-alt-zh][data-alt-en]').forEach(element => {
      element.alt = element.getAttribute('data-alt-' + language);
    });
    document.title = language === 'zh' ? 'Kieran | 学术主页' : 'Kieran | Academic Homepage';
    document.querySelector('meta[name="description"]').content = language === 'zh'
      ? 'Kieran 的学术主页：计算机视觉、显著性目标检测项目、AI 学习资源与开源工具。'
      : 'Kieran’s academic homepage: computer vision, salient object detection projects, AI learning resources, and open-source tools.';
    document.querySelector('.brand').setAttribute('aria-label', language === 'zh' ? 'Kieran 首页' : 'Kieran homepage');
    languageButton.textContent = language === 'zh' ? 'EN' : '中文';
    languageButton.setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换为中文');
    languageButton.title = languageButton.getAttribute('aria-label');
    updateThemeButton();
  }

  languageButton.addEventListener('click', () => {
    language = language === 'zh' ? 'en' : 'zh';
    applyLanguage();
    save(keys.language, language);
  });
  themeButton.addEventListener('click', () => {
    manualTheme = true;
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    save(keys.theme, theme);
  });
  systemTheme.addEventListener('change', event => {
    if (!manualTheme) {
      theme = event.matches ? 'dark' : 'light';
      applyTheme();
    }
  });
  applyTheme();
  applyLanguage();
  languageButton.hidden = false;
  themeButton.hidden = false;
})();
