#!/usr/bin/env node
// u4eceu539fu59cbu4e60u9898u3001u7b54u6848u8868u548cu89e3u6790u6784u5efau53efu79bbu7ebfu6253u5f00u7684u5355u6587u4ef6u9898u5e93u3002
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
      type = line.includes('u5355u9009') ? 'single' : line.includes('u591au9009') ? 'multiple' : line.includes('u5224u65ad') ? 'boolean' : null;
      current = null;
      continue;
    }
    const match = line.match(/^\*\*(\d+)\.\*\*\s*(.*)$/) || line.match(/^\*\*(\d+)[.u3001]\s*(.*?)\s*\*\*$/);
    if (match) {
      assert(type, `u9898u578bu7f3au5931uff1a${line}`);
      current = { number: Number(match[1]), type, stem: match[2].trim(), options: [] };
      questions.push(current);
      continue;
    }
    const option = line.match(/^- ([A-E])[.u3001uff0e]\s*(.*)$/);
    if (option && current) current.options.push({ key: option[1], text: option[2] });
  }
  return questions;
}

function parseAnswers(source) {
  let numbers = [];
  const answers = new Map();
  for (const line of source.split('\n')) {
    const cells = line.split('|').map(cell => cell.trim()).slice(1, -1);
    if (cells[0] === 'u9898u53f7') numbers = cells.slice(1).map(Number);
    if (cells[0] === 'u7b54u6848') {
      assert.equal(cells.length - 1, numbers.length, 'u7b54u6848u8868u5217u6570u4e0du5339u914d');
      numbers.forEach((number, index) => {
        assert(!answers.has(number), `u91cdu590du7b54u6848uff1a${number}`);
        answers.set(number, cells[index + 1].replace(/[u26a0u203b*\s]/g, '').replace('u5bf9', 'u221a').replace('u9519', 'u00d7'));
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
      inSection = line.includes('u9010u9898u89e3u6790');
      continue;
    }
    if (!inSection) continue;
    if (/^(---|>)/.test(line)) { flush(); inSection = false; continue; }
    const match = line.match(/^\*\*(\d+)[.u3001]/);
    if (match) {
      flush();
      number = Number(match[1]);
      // u4fddu7559u539fu6807u9898u4e2du7684u8bfeu7a0bu53e3u5f84u548cu4e89u8baeu8bf4u660euff0cu4e0du81eau884cu6539u5199u89e3u6790u3002
      lines.push(line.replace(/^\*\*\d+[.u3001]\s*/, '**'));
    } else if (number !== null) lines.push(line);
  }
  flush();
  return explanations;
}

const notes = {
  '6-5': 'u539fu8d44u6599u63d0u793auff1au53c2u8003u7b54u6848 D u4e0eu901au884cu7406u89e3u5b58u5728u5deeu5f02uff0cu8bf7u7ed3u5408u8bfeu4ef6u6838u5bf9u3002',
  '8-3': 'u539fu8d44u6599u63d0u793auff1au672cu9898u4f9du636eu53c2u8003u7b54u6848u6e90u6574u7406uff0cu8bf7u7ed3u5408u8bfeu4ef6u6838u5bf9u3002',
  '8-5': 'u539fu8d44u6599u63d0u793auff1au672cu9898u4f9du636eu53c2u8003u7b54u6848u6e90u6574u7406uff0cu8bf7u7ed3u5408u8bfeu4ef6u6838u5bf9u3002',
  '8-15': 'u539fu9898u4e3au56feu7247u9009u9879uff1bu5f53u524du8d44u6599u4ec5u6709u56feu7247u7684u6587u5b57u63cfu8ff0uff0cu4e0bu65b9u6309u539fu63cfu8ff0u5448u73b0u3002',
  '9-7': 'u539fu8d44u6599u63d0u793auff1au53c2u8003u7b54u6848u4e3a ABCDuff1bu6309u89c4u8303u539fu6587u7684u201cu57fau672cu4f26u7406u8981u6c42u201du8303u56f4u5e94u4e3a ACDuff0cu8be6u89c1u89e3u6790u3002',
  '10-3': 'u6cbfu7528u6574u5408u8d44u6599u4e2du5df2u786eu8ba4u7684u8bfeu4ef6u53e3u5f84uff1aCuff081977 u5e74u6ce2u97f3 707 u5ba2u673au7a7au96beuff09u3002',
  '10-8': 'u539fu8d44u6599u5bf9u6b64u9898u4f5cu4e86u5b58u7591u6807u8bb0uff0cu8bf7u7ed3u5408u8bfeu4ef6u6838u5bf9u3002',
  '11-2': 'u539fu8d44u6599u63d0u793auff1au672cu9898u91c7u7528u8bfeu7a0bu8868u8ff0uff0cu8be6u89c1u89e3u6790u3002',
  '11-13': 'u539fu8d44u6599u63d0u793auff1au672cu9898u7b54u6848u4e0eu76f4u89c9u5b58u5728u5deeu5f02uff0cu8bf7u7ed3u5408u8bfeu4ef6u6838u5bf9u3002',
  '14-5': 'u539fu8d44u6599u5bf9u672cu9898u6807u6ce8u5b58u7591uff1au8d23u4efbu4e3bu4f53u53d6u51b3u4e8eu8f85u52a9u9a7eu9a76u6216u5b8cu5168u65e0u4ebau9a7eu9a76u7684u5177u4f53u8bedu5883uff0cu8bf7u7ed3u5408u8bfeu4ef6u6838u5bf9u3002',
  '14-6': 'u539fu8d44u6599u5bf9u672cu9898u6807u6ce8u5b58u7591uff1au8bfeu7a0bu91c7u7528u4f24u5bb3u6700u5c0fu5316u7684u53e3u5f84uff0cu8bf7u7ed3u5408u8bfeu4ef6u6838u5bf9u3002'
};

const chapters = [], questions = [];
for (let chapter = 1; chapter <= 15; chapter++) {
  const questionFile = files.find(f => f.startsWith(`u7b2c${chapter}u8bb2 `) && f.endsWith(' u4e60u9898.md'));
  const answerFile = files.find(f => f.startsWith(`u7b2c${chapter}u8bb2 `) && f.endsWith('u4e60u9898-u7b54u6848u7248.md'));
  assert(questionFile && answerFile, `u7b2c ${chapter} u8bb2u7f3au5c11u539fu59cbu8d44u6599`);
  const title = questionFile.replace(/^u7b2c\d+u8bb2 /, '').replace(/ u4e60u9898.md$/, '');
  const parsed = parseQuestions(read(questionFile));
  const answers = parseAnswers(read(answerFile));
  const explanations = parseExplanations(read(answerFile));
  assert.equal(parsed.length, expected[chapter - 1], `u7b2c ${chapter} u8bb2u9898u76eeu6570u91cf`);
  assert.equal(answers.size, parsed.length, `u7b2c ${chapter} u8bb2u7b54u6848u6570u91cf`);
  assert.equal(explanations.size, parsed.length, `u7b2c ${chapter} u8bb2u89e3u6790u6570u91cf`);
  parsed.forEach((question, index) => {
    assert.equal(question.number, index + 1, `u7b2c ${chapter} u8bb2u9898u53f7u4e0du8fdeu7eed`);
    const id = `${chapter}-${question.number}`;
    const answer = id === '10-3' ? 'C' : answers.get(question.number);
    if (question.type === 'boolean') {
      assert(/^[u221au00d7]$/.test(answer), `${id} u5224u65adu9898u7b54u6848u4e0du5408u6cd5`);
      assert.equal(question.options.length, 0, `${id} u5224u65adu9898u6709u672au5904u7406u7684u539fu59cbu9009u9879`);
      question.options = [{ key: 'u221a', text: 'u6b63u786e' }, { key: 'u00d7', text: 'u9519u8bef' }];
    } else {
      assert(/^[A-E]+$/.test(answer), `${id} u9009u62e9u9898u7b54u6848u4e0du5408u6cd5`);
      assert(question.options.length >= 2, `${id} u9009u9879u7f3au5931`);
      assert.equal(new Set(question.options.map(o => o.key)).size, question.options.length, `${id} u91cdu590du9009u9879`);
      assert([...answer].every(key => question.options.some(o => o.key === key)), `${id} u7b54u6848u8d85u51fau9009u9879u8303u56f4`);
      assert(question.type !== 'single' || answer.length === 1, `${id} u5355u9009u9898u542bu591au4e2au7b54u6848`);
    }
    assert(explanations.get(question.number), `${id} u89e3u6790u4e3au7a7a`);
    questions.push({ id, chapter, ...question, answer: [...answer], explanation: explanations.get(question.number), note: notes[id] || '' });
  });
  chapters.push({ number: chapter, title, count: parsed.length });
}

// u72ecu7acbu5bf9u7167u5df2u7ecfu786eu8ba4u7684u6574u5408u7248uff0cu907fu514du5bfcu5165u65f6u9898u53f7u4e0eu7b54u6848u9519u4f4du3002
let chapter = 0, number = 0, checked = 0;
for (const line of read('u5de5u7a0bu4f26u7406 u7b2c1-15u8bb2 u4e60u9898u7b54u6848u6574u5408.md').split('\n')) {
  const heading = line.match(/^## u7b2c(\d+)u8bb2/);
  const question = line.match(/^\*\*(\d+)\.\*\*/);
  const answer = line.match(/^u7b54u6848uff1a\*\*([A-Eu221au00d7]+)\*\*/);
  if (heading) chapter = Number(heading[1]);
  if (question) number = Number(question[1]);
  if (answer) {
    assert.equal(questions.find(q => q.id === `${chapter}-${number}`)?.answer.join(''), answer[1], `u4e0eu6574u5408u7248u7b54u6848u4e0du540cuff1a${chapter}-${number}`);
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
console.log(`u5df2u751fu6210 index.htmluff1a${chapters.length} u8bb2 / ${questions.length} u9898uff0cu5168u90e8u7b54u6848u4e0eu6574u5408u7248u4e00u81f4u3002`);
console.log(`u5355u9009 ${counts.single} / u591au9009 ${counts.multiple} / u5224u65ad ${counts.boolean}uff1b303 u6761u89e3u6790u5b8cu6574u3002`);
