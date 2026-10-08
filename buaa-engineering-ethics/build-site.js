#!/usr/bin/env node
// 从原始习题、答案表和解析构建可离线打开的单文件题库。
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = __dirname;
const expected = [20, 23, 18, 23, 20, 22, 22, 24, 19, 20, 19, 11, 21, 18, 23];
const files = fs.readdirSync(root);
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function parseQuestions(source) {
  const questions = [];
  let current, type;
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('##')) {
      type = line.includes('单选') ? 'single' : line.includes('多选') ? 'multiple' : line.includes('判断') ? 'boolean' : null;
      current = null;
      continue;
    }
    const match = line.match(/^\*\*(\d+)\.\*\*\s*(.*)$/) || line.match(/^\*\*(\d+)[.、]\s*(.*?)\s*\*\*$/);
    if (match) {
      assert(type, `题型缺失：${line}`);
      current = { number: Number(match[1]), type, stem: match[2].trim(), options: [] };
      questions.push(current);
      continue;
    }
    const option = line.match(/^- ([A-E])[.、．]\s*(.*)$/);
    if (option && current) current.options.push({ key: option[1], text: option[2] });
  }
  return questions;
}

function parseAnswers(source) {
  let numbers = [];
  const answers = new Map();
  for (const line of source.split('\n')) {
    const cells = line.split('|').map(cell => cell.trim()).slice(1, -1);
    if (cells[0] === '题号') numbers = cells.slice(1).map(Number);
    if (cells[0] === '答案') {
      assert.equal(cells.length - 1, numbers.length, '答案表列数不匹配');
      numbers.forEach((number, index) => {
        assert(!answers.has(number), `重复答案：${number}`);
        answers.set(number, cells[index + 1].replace(/[⚠※*\s]/g, '').replace('对', '√').replace('错', '×'));
      });
    }
  }
  return answers;
}

function parseExplanations(source) {
  const explanations = new Map();
  let inSection = false, number = null, lines = [];
  const flush = () => {
    if (number !== null) explanations.set(number, lines.join('\n').trim());
    number = null;
    lines = [];
  };
  for (const line of source.split('\n')) {
    if (/^##/.test(line)) {
      flush();
      inSection = line.includes('逐题解析');
      continue;
    }
    if (!inSection) continue;
    if (/^(---|>)/.test(line)) { flush(); inSection = false; continue; }
    const match = line.match(/^\*\*(\d+)[.、]/);
    if (match) {
      flush();
      number = Number(match[1]);
      // 保留原标题中的课程口径和争议说明，不自行改写解析。
      lines.push(line.replace(/^\*\*\d+[.、]\s*/, '**'));
    } else if (number !== null) lines.push(line);
  }
  flush();
  return explanations;
}

const notes = {
  '6-5': '原资料提示：参考答案 D 与通行理解存在差异，请结合课件核对。',
  '8-3': '原资料提示：本题依据参考答案源整理，请结合课件核对。',
  '8-5': '原资料提示：本题依据参考答案源整理，请结合课件核对。',
  '8-15': '原题为图片选项；当前资料仅有图片的文字描述，下方按原描述呈现。',
  '9-7': '原资料提示：参考答案为 ABCD；按规范原文的“基本伦理要求”范围应为 ACD，详见解析。',
  '10-3': '沿用整合资料中已确认的课件口径：C（1977 年波音 707 客机空难）。',
  '10-8': '原资料对此题作了存疑标记，请结合课件核对。',
  '11-2': '原资料提示：本题采用课程表述，详见解析。',
  '11-13': '原资料提示：本题答案与直觉存在差异，请结合课件核对。',
  '14-5': '原资料对本题标注存疑：责任主体取决于辅助驾驶或完全无人驾驶的具体语境，请结合课件核对。',
  '14-6': '原资料对本题标注存疑：课程采用伤害最小化的口径，请结合课件核对。'
};

const chapters = [], questions = [];
for (let chapter = 1; chapter <= 15; chapter++) {
  const questionFile = files.find(f => f.startsWith(`第${chapter}讲 `) && f.endsWith(' 习题.md'));
  const answerFile = files.find(f => f.startsWith(`第${chapter}讲 `) && f.endsWith('习题-答案版.md'));
  assert(questionFile && answerFile, `第 ${chapter} 讲缺少原始资料`);
  const title = questionFile.replace(/^第\d+讲 /, '').replace(/ 习题.md$/, '');
  const parsed = parseQuestions(read(questionFile));
  const answers = parseAnswers(read(answerFile));
  const explanations = parseExplanations(read(answerFile));
  assert.equal(parsed.length, expected[chapter - 1], `第 ${chapter} 讲题目数量`);
  assert.equal(answers.size, parsed.length, `第 ${chapter} 讲答案数量`);
  assert.equal(explanations.size, parsed.length, `第 ${chapter} 讲解析数量`);
  parsed.forEach((question, index) => {
    assert.equal(question.number, index + 1, `第 ${chapter} 讲题号不连续`);
    const id = `${chapter}-${question.number}`;
    const answer = id === '10-3' ? 'C' : answers.get(question.number);
    if (question.type === 'boolean') {
      assert(/^[√×]$/.test(answer), `${id} 判断题答案不合法`);
      assert.equal(question.options.length, 0, `${id} 判断题有未处理的原始选项`);
      question.options = [{ key: '√', text: '正确' }, { key: '×', text: '错误' }];
    } else {
      assert(/^[A-E]+$/.test(answer), `${id} 选择题答案不合法`);
      assert(question.options.length >= 2, `${id} 选项缺失`);
      assert.equal(new Set(question.options.map(o => o.key)).size, question.options.length, `${id} 重复选项`);
      assert([...answer].every(key => question.options.some(o => o.key === key)), `${id} 答案超出选项范围`);
      assert(question.type !== 'single' || answer.length === 1, `${id} 单选题含多个答案`);
    }
    assert(explanations.get(question.number), `${id} 解析为空`);
    questions.push({ id, chapter, ...question, answer: [...answer], explanation: explanations.get(question.number), note: notes[id] || '' });
  });
  chapters.push({ number: chapter, title, count: parsed.length });
}

// 独立对照已经确认的整合版，避免导入时题号与答案错位。
let chapter = 0, number = 0, checked = 0;
for (const line of read('工程伦理 第1-15讲 习题答案整合.md').split('\n')) {
  const heading = line.match(/^## 第(\d+)讲/);
  const question = line.match(/^\*\*(\d+)\.\*\*/);
  const answer = line.match(/^答案：\*\*([A-E√×]+)\*\*/);
  if (heading) chapter = Number(heading[1]);
  if (question) number = Number(question[1]);
  if (answer) {
    assert.equal(questions.find(q => q.id === `${chapter}-${number}`)?.answer.join(''), answer[1], `与整合版答案不同：${chapter}-${number}`);
    checked++;
  }
}
assert.equal(checked, 303);
assert.equal(questions.length, 303);
const data = { version: 1, chapters, questions };
const serialized = JSON.stringify(data).replace(/</g, '\\u003c');
const html = read('web/index.template.html')
  .replace('/* INLINE_STYLES */', () => read('web/styles.css'))
  .replace('/* INLINE_DATA */', () => `window.QUESTION_BANK = ${serialized};`)
  .replace('/* INLINE_APP */', () => read('web/app.js'));
fs.writeFileSync(path.join(root, 'index.html'), html);
fs.writeFileSync(path.join(root, 'questions.json'), JSON.stringify(data, null, 2) + '\n');
const counts = Object.fromEntries(['single', 'multiple', 'boolean'].map(type => [type, questions.filter(q => q.type === type).length]));
console.log(`已生成 index.html：${chapters.length} 讲 / ${questions.length} 题，全部答案与整合版一致。`);
console.log(`单选 ${counts.single} / 多选 ${counts.multiple} / 判断 ${counts.boolean}；303 条解析完整。`);
