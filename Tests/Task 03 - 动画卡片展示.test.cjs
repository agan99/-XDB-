const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = require('../媒体库-动画卡片.xdb.js');
const { animeCard, mediaProgress } = plugin;

function bodyWith(value) {
  return `**已观看集数**： ${value}`;
}

// 用户会自行给 .xdb 改名（媒体库.xdb → 动画媒体库.xdb …），
// 所以按扩展点 id 去找库，不钉死文件名。
function readLibraryContaining(marker) {
  const base = path.join(__dirname, '..');
  const candidates = fs.readdirSync(base).filter((name) => name.endsWith('.xdb')).sort();
  for (const name of candidates) {
    const raw = fs.readFileSync(path.join(base, name), 'utf8');
    if (raw.includes(marker)) return JSON.parse(raw);
  }
  throw new Error(`在 ${base} 下找不到含「${marker}」的 .xdb`);
}

test('标题按中文名、原名、name 和占位依次 fallback', () => {
  assert.equal(animeCard.resolveTitle({ 中文名: '中文', 原名: '原名', name: 'name' }), '中文');
  assert.equal(animeCard.resolveTitle({ 中文名: '', 原名: '原名', name: 'name' }), '原名');
  assert.equal(animeCard.resolveTitle({ 中文名: ' ', 原名: '', name: 'name' }), 'name');
  assert.equal(animeCard.resolveTitle({}), '未命名动画');
});

test('四种正式状态映射正确', () => {
  assert.equal(animeCard.statusPresentation('💭 未来也许').label, '暂缓');
  assert.equal(animeCard.statusPresentation('⏳ 待定').label, '想看');
  assert.equal(animeCard.statusPresentation('▶️ 进行中').label, '在看');
  assert.equal(animeCard.statusPresentation('✅ 已完成').label, '已看');
});

test('只有进行中和已完成支持快速互换', () => {
  assert.equal(animeCard.nextQuickStatus('▶️ 进行中'), '✅ 已完成');
  assert.equal(animeCard.nextQuickStatus('✅ 已完成'), '▶️ 进行中');
  assert.equal(animeCard.nextQuickStatus('💭 未来也许'), null);
  assert.equal(animeCard.nextQuickStatus('⏳ 待定'), null);
  assert.equal(animeCard.nextQuickStatus('未知'), null);
});

test('tags 保持顺序、过滤空项并最多取前 5 个', () => {
  assert.deepEqual(animeCard.firstTags(['一', '', '二', '三', '四', '五', '六']), [
    '一',
    '二',
    '三',
    '四',
    '五',
  ]);
  assert.deepEqual(animeCard.firstTags([]), []);
  assert.deepEqual(animeCard.firstTags(null), []);
});

test('个人评分为空时保留空位，0 仍是有效值', () => {
  assert.deepEqual(animeCard.ratingPresentation(null), { hasValue: false, label: '' });
  assert.deepEqual(animeCard.ratingPresentation(''), { hasValue: false, label: '' });
  assert.deepEqual(animeCard.ratingPresentation(0), { hasValue: true, label: '0' });
  assert.deepEqual(animeCard.ratingPresentation(7.5), { hasValue: true, label: '7.5' });
});

test('开播日期只把有效 YYYY-MM-DD 格式化为年月', () => {
  assert.equal(animeCard.formatPremiereMonth('2026-07-04'), '2026年07月');
  assert.equal(animeCard.formatPremiereMonth('2026-02-29'), null);
  assert.equal(animeCard.formatPremiereMonth('2026-7-04'), null);
  assert.equal(animeCard.formatPremiereMonth(null), null);
});

test('description 区分查看模式与空态输入模式', () => {
  assert.deepEqual(animeCard.descriptionPresentation('简介'), { mode: 'view', value: '简介' });
  assert.deepEqual(animeCard.descriptionPresentation('  '), { mode: 'empty', value: '' });
  assert.deepEqual(animeCard.descriptionPresentation(null), { mode: 'empty', value: '' });
});

test('只有进行中状态显示加减控件', () => {
  const progress = mediaProgress.read(bodyWith(6), 12);
  assert.equal(animeCard.progressPresentation(progress, '▶️ 进行中').showStepControls, true);
  assert.equal(animeCard.progressPresentation(progress, '✅ 已完成').showStepControls, false);
  assert.equal(animeCard.progressPresentation(progress, '⏳ 待定').showStepControls, false);
});

test('current 为空时保持未知且不能加减', () => {
  const progress = mediaProgress.read(bodyWith(''), 12);
  assert.deepEqual(animeCard.progressPresentation(progress, '▶️ 进行中'), {
    currentLabel: '?',
    totalLabel: '12',
    percentageLabel: null,
    fillPercentage: null,
    reachedTotal: null,
    showStepControls: true,
    canDecrement: false,
    canIncrement: false,
  });
});

test('total 未知时不伪造 percentage，且允许增加', () => {
  const progress = mediaProgress.read(bodyWith(6), null);
  const presentation = animeCard.progressPresentation(progress, '▶️ 进行中');
  assert.equal(presentation.totalLabel, '?');
  assert.equal(presentation.percentageLabel, null);
  assert.equal(presentation.fillPercentage, null);
  assert.equal(presentation.canIncrement, true);
});

test('total 为 0 时不显示 percentage 且不能增加', () => {
  const progress = mediaProgress.read(bodyWith(0), 0);
  const presentation = animeCard.progressPresentation(progress, '▶️ 进行中');
  assert.equal(presentation.percentageLabel, null);
  assert.equal(presentation.canIncrement, false);
});

test('已有 current 超过 total 时保留大于 100 的标签并限制条形宽度', () => {
  const progress = mediaProgress.read(bodyWith(13), 12);
  const presentation = animeCard.progressPresentation(progress, '▶️ 进行中');
  assert.equal(presentation.percentageLabel, '108%');
  assert.equal(presentation.fillPercentage, 100);
  assert.equal(presentation.reachedTotal, true);
  assert.equal(presentation.canIncrement, false);
});

test('XDB 保留动画卡片功能字段并挂到画廊 view', () => {
  const definition = readLibraryContaining('agan:anime-card');
  assert.equal(definition.source, 'file');
  assert.deepEqual(
    definition.fields.filter((field) => field.type === 'agan:anime-card'),
    [{ name: '动画卡片', type: 'agan:anime-card' }],
  );
  // 用户会自行增删这个 .xdb 里的 view（原有的 anime-data-table 已被用户移除），
  // 所以只断言「动画卡片字段被动画画廊 view 使用」，不钉死具体 view 列表。
  const gallery = definition.views.find((view) => view.type === 'agan:anime-gallery');
  assert.ok(gallery, '动画画廊 view 应存在');
  assert.ok(
    Array.isArray(gallery.visibleFields) && gallery.visibleFields.includes('动画卡片'),
    '动画画廊 view 应使用动画卡片字段',
  );
});

test('卡片写回范围受限且进度只调用唯一 Media Progress 核心', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '媒体库-动画卡片.xdb.js'), 'utf8');
  const cardStart = source.indexOf('function renderAnimeCard');
  const cardEnd = source.indexOf('\nmodule.exports =');
  const cardSource = source.slice(cardStart, cardEnd);
  const updateFields = Array.from(
    source.matchAll(/updateCell\(props\.row\.id,\s*'([^']+)'/gu),
    (match) => match[1],
  ).sort();

  assert.deepEqual(updateFields, ['description', '收藏', '状态'].sort());
  assert.equal((source.match(/const MARKER_PATTERN/gu) ?? []).length, 1);
  assert.doesNotMatch(cardSource, /MARKER_PATTERN|matchAll\(/u);
  assert.match(cardSource, /mediaProgress\.read\(/u);
  assert.match(cardSource, /mediaProgress\.updateBody\(/u);
  assert.equal((source.match(/function createAnimeCardInstance\(/gu) ?? []).length, 1);
  assert.match(source, /view: createAnimeCardInstance/u);
});
