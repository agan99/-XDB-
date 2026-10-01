const test = require('node:test');
const assert = require('node:assert/strict');

const plugin = require('../媒体库-动画卡片.xdb.js');
const { mediaProgress, MediaProgressError } = plugin;

function bodyWith(value, newline = '\n') {
  return [`引言`, `**已观看集数**：${value}`, `**观看路径**： [[动画]]`].join(newline);
}

function assertProgressError(code, operation) {
  assert.throws(operation, (error) => error instanceof MediaProgressError && error.code === code);
}

test('读取 current、total 和统一进度结果', () => {
  assert.deepEqual(mediaProgress.read(bodyWith(' 6'), 12), {
    current: 6,
    total: 12,
    unit: '集',
    percentage: 50,
    reachedTotal: false,
  });
});

test('current 为空时保留 null，不转换为 0', () => {
  assert.deepEqual(mediaProgress.read(bodyWith('   '), 12), {
    current: null,
    total: 12,
    unit: '集',
    percentage: null,
    reachedTotal: null,
  });
});

test('total 未知时派生值为 null', () => {
  assert.deepEqual(mediaProgress.read(bodyWith(' 6'), null), {
    current: 6,
    total: null,
    unit: '集',
    percentage: null,
    reachedTotal: null,
  });
});

test('已有 current 大于 total 时按原值展示', () => {
  const result = mediaProgress.read(bodyWith(' 13'), 12);
  assert.equal(result.current, 13);
  assert.equal(result.total, 12);
  assert.ok(result.percentage > 100);
  assert.equal(result.reachedTotal, true);
});

test('合法修改只替换唯一目标行', () => {
  const before = bodyWith(' 6');
  const after = mediaProgress.updateBody(before, 12, 7);
  assert.equal(after, bodyWith(' 7'));
});

test('合法修改保留 CRLF 换行', () => {
  const before = bodyWith(' 6', '\r\n');
  const after = mediaProgress.updateBody(before, 12, 7);
  assert.equal(after, bodyWith(' 7', '\r\n'));
});

test('newCurrent 大于 total 时拒绝且原正文不变', () => {
  const before = bodyWith(' 6');
  assertProgressError('EXCEEDS_TOTAL', () => mediaProgress.updateBody(before, 12, 13));
  assert.equal(before, bodyWith(' 6'));
});

test('total 未知时允许合法整数修改', () => {
  assert.equal(mediaProgress.updateBody(bodyWith(' 6'), null, 20), bodyWith(' 20'));
});

test('负数、小数和非数字修改值被拒绝', () => {
  for (const value of [-1, 1.5, Number.NaN, '2']) {
    assertProgressError('INVALID_NEW_CURRENT', () =>
      mediaProgress.updateBody(bodyWith(' 1'), 12, value),
    );
  }
});

test('标记缺失或重复时拒绝写入', () => {
  assertProgressError('MISSING_MARKER', () => mediaProgress.updateBody('没有进度标记', 12, 1));
  const duplicate = `${bodyWith(' 1')}\n**已观看集数**： 2`;
  assertProgressError('DUPLICATE_MARKER', () => mediaProgress.updateBody(duplicate, 12, 1));
});

test('格式非法的已有 current 不会被静默当作空值', () => {
  assertProgressError('INVALID_CURRENT', () => mediaProgress.read(bodyWith(' 1.5'), 12));
});

test('0 可以正常读取和写入', () => {
  const read = mediaProgress.read(bodyWith(' 0'), 12);
  assert.equal(read.current, 0);
  assert.equal(read.percentage, 0);
  assert.equal(read.reachedTotal, false);
  assert.equal(mediaProgress.updateBody(bodyWith(' 6'), 12, 0), bodyWith(' 0'));
});
