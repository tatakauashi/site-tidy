const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { matches, parsePattern, selectors } = require('../extension/matcher.js');

test('host and path patterns match independently and reject lookalike hosts', () => {
  for (const url of ['https://example.com/', 'http://a.b.example.com/foo']) assert.equal(matches('*.example.com', url), true);
  for (const url of ['https://example.com.evil.test/', 'https://notexample.com/', 'file:///example.com']) assert.equal(matches('*.example.com', url), false);
  assert.equal(matches('example*.com', 'https://example123.com/foo'), true);
  assert.equal(matches('example*.com', 'https://example123.com.evil.test/foo'), false);
  for (const path of ['/foo', '/foo/bar', '/foobar']) assert.equal(matches('example.com/foo*', 'https://example.com' + path), true);
  assert.equal(matches('example.com/foo*', 'https://example.com/bar?next=/foo'), false);
  assert.equal(matches('example.com/foo', 'https://example.com/foo?x=1#foo'), true);
  assert.equal(matches('https://example.com/*', 'http://example.com/'), false);
  assert.equal(matches('example.com/foo.bar', 'https://example.com/fooXbar'), false);
});
test('invalid conditions and CSS declaration injection are rejected', () => {
  for (const pattern of ['*', 'javascript://example.com', 'example.com?x=1', 'example.com/foo?x=*', 'example.com/#x', 'example.com@evil.test']) assert.throws(() => parsePattern(pattern));
  const doc = { querySelector() { return null; } };
  for (const text of ['.ad { color:red }', '.ad/*comment*/', '', '.ad } body {display:none']) assert.throws(() => selectors(text, doc));
  assert.deepEqual(selectors('.ad\n #banner\n', doc), ['.ad', '#banner']);
});
test('host question mark requires one character while star allows zero', () => {
  assert.equal(matches('example*.com', 'https://example.com/'), true);
  assert.equal(matches('example?*.com', 'https://example.com/'), false);
  for (const host of ['example1.com', 'exampleabc.com']) assert.equal(matches('example?*.com', 'https://' + host + '/'), true);
  assert.equal(matches('example?.com', 'https://example1.com/'), true);
  assert.equal(matches('example?.com', 'https://example12.com/'), false);
  assert.equal(matches('example?*.com', 'https://example1.com.evil.test/'), false);
  assert.equal(matches('example?*.com/foo*', 'https://example1.com/foo/bar'), true);
  assert.equal(matches('example?*.com/foo*', 'https://example1.com/bar'), false);
  assert.equal(matches('*.example?*.com', 'https://example1.com/'), true);
  assert.equal(matches('*.example?*.com', 'https://www.example1.com/'), true);
  assert.equal(matches('*.example?*.com', 'https://example.com/'), false);
});
test('content applies CSS, restores by removing its rules, and follows SPA paths', async () => {
  let change;
  let tick;
  const style = { dataset: {}, isConnected: false, textContent: '' };
  const document = { createElement: () => style, querySelector: () => null,
    documentElement: { append(element) { element.isConnected = true; } } };
  const context = { SiteRules: { matches, selectors }, document, location: { href: 'https://example.com/foo' },
    MutationObserver: class { observe() {} }, setInterval(callback) { tick = callback; },
    chrome: { storage: { local: { async get() { return { rules: [{ enabled: true, pattern: 'example.com/foo*', selectors: '.ad' }] }; } },
      onChanged: { addListener(callback) { change = callback; } } } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../extension/content.js'), 'utf8'), context);
  await Promise.resolve();
  assert.equal(style.textContent, '.ad { display: none !important; }');
  change({ rules: { newValue: [{ enabled: false, pattern: 'example.com/foo*', selectors: '.ad' }] } }, 'local');
  assert.equal(style.textContent, '');
  change({ rules: { newValue: [{ enabled: true, pattern: 'example.com/foo*', selectors: '.ad' }] } }, 'local');
  context.location.href = 'https://example.com/bar'; tick(); assert.equal(style.textContent, '');
});
