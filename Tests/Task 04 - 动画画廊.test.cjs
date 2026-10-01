const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = require('../媒体库-动画卡片.xdb.js');
const { animeGallery } = plugin;

function row(id, item = {}) {
  return { id, $item: item };
}

function titles(rows) {
  return rows.map((entry) => entry.$item['中文名']);
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

const sampleRows = [
  row('watching', {
    中文名: 'Alpha 战斗',
    原名: 'First Show',
    tags: ['科幻', 'Team Blue'],
    状态: '▶️ 进行中',
    收藏: true,
    总集数: 12,
    开播日期: '2026-07-04',
    个人评分: 8,
    Bangumi评分: 7.5,
  }),
  row('planned', {
    中文名: 'Beta',
    原名: 'Second Show',
    tags: ['日常'],
    状态: '⏳ 待定',
    收藏: false,
    总集数: '',
    开播日期: '2026-04-01',
    个人评分: null,
    Bangumi评分: 8,
  }),
  row('paused', {
    中文名: 'Gamma',
    原名: 'Third Show',
    tags: ['科幻'],
    状态: '💭 未来也许',
    收藏: true,
    总集数: null,
    开播日期: null,
    个人评分: 0,
    Bangumi评分: null,
  }),
  row('completed', {
    中文名: 'Delta',
    原名: 'Fourth Show',
    tags: [],
    状态: '✅ 已完成',
    收藏: false,
    总集数: 0,
    开播日期: '2025-01-01',
    个人评分: 9,
    Bangumi评分: 9,
  }),
  row('invalid', {
    中文名: 'Epsilon',
    原名: 'Hidden English',
    tags: ['实验'],
    状态: '未知',
    收藏: false,
    总集数: '非法',
    开播日期: '2027-01-01',
    个人评分: 7,
    Bangumi评分: 6,
  }),
];

test('嵌套 groups 展平并按 row id 去重', () => {
  const groups = [
    {
      rows: [sampleRows[0], sampleRows[1]],
      groups: [{ rows: [sampleRows[0], sampleRows[2]] }],
    },
  ];
  assert.deepEqual(animeGallery.collectRows(groups).map((entry) => entry.id), [
    'watching',
    'planned',
    'paused',
  ]);
});

test('全库统计不受筛选和搜索状态影响', () => {
  const state = {
    ...animeGallery.createState(),
    status: 'watching',
    favoriteOnly: true,
    query: 'alpha',
  };
  assert.deepEqual(animeGallery.resolve(sampleRows, state).counts, {
    all: 5,
    watching: 1,
    planned: 1,
    completed: 1,
    paused: 1,
    favorite: 2,
    unknownTotal: 2,
  });
});

test('状态单选可再次点击恢复全部，全部只清除状态', () => {
  let state = { ...animeGallery.createState(), favoriteOnly: true, unknownTotalOnly: true };
  state = animeGallery.toggleStatus(state, 'watching');
  assert.equal(state.status, 'watching');
  state = animeGallery.toggleStatus(state, 'watching');
  assert.equal(state.status, null);
  assert.equal(state.favoriteOnly, true);
  assert.equal(state.unknownTotalOnly, true);
});

test('状态、收藏和集数未知按 AND 组合', () => {
  const state = {
    ...animeGallery.createState(),
    status: 'paused',
    favoriteOnly: true,
    unknownTotalOnly: true,
  };
  assert.deepEqual(animeGallery.filterRows(sampleRows, state).map((entry) => entry.id), ['paused']);
});

test('总集数空值为未知，0 和非法值都不冒充未知', () => {
  assert.equal(animeGallery.isUnknownTotal({ 总集数: undefined }), true);
  assert.equal(animeGallery.isUnknownTotal({ 总集数: '  ' }), true);
  assert.equal(animeGallery.isUnknownTotal({ 总集数: 0 }), false);
  assert.equal(animeGallery.isUnknownTotal({ 总集数: '非法' }), false);
});

test('搜索忽略首尾空格和英文大小写并使用包含匹配', () => {
  const state = { ...animeGallery.createState(), query: '  TEAM blue  ' };
  assert.deepEqual(animeGallery.filterRows(sampleRows, state).map((entry) => entry.id), ['watching']);
});

test('多关键词之间 AND、三个字段之间 OR', () => {
  const state = { ...animeGallery.createState(), query: 'first 科幻' };
  assert.deepEqual(animeGallery.filterRows(sampleRows, state).map((entry) => entry.id), ['watching']);
});

test('搜索不包含 name 和 description', () => {
  const rows = [row('only-other-fields', { name: 'needle', description: 'needle' })];
  const state = { ...animeGallery.createState(), query: 'needle' };
  assert.deepEqual(animeGallery.filterRows(rows, state), []);
});

test('默认排序使用状态优先级并把非法状态放最后', () => {
  assert.deepEqual(titles(animeGallery.sortRows(sampleRows.slice().reverse(), null)), [
    'Alpha 战斗',
    'Beta',
    'Gamma',
    'Delta',
    'Epsilon',
  ]);
});

test('默认排序在同状态内按日期倒序、再按标题正序', () => {
  const rows = [
    row('b', { 中文名: 'B', 状态: '▶️ 进行中', 开播日期: '2025-01-01' }),
    row('a', { 中文名: 'A', 状态: '▶️ 进行中', 开播日期: '2025-01-01' }),
    row('new', { 中文名: 'C', 状态: '▶️ 进行中', 开播日期: '2026-01-01' }),
  ];
  assert.deepEqual(titles(animeGallery.sortRows(rows, null)), ['C', 'A', 'B']);
});

test('四种主动排序按默认方向、反向、再恢复默认', () => {
  for (const key of Object.keys(animeGallery.sorts)) {
    const first = animeGallery.cycleSort(null, key);
    assert.equal(first.direction, animeGallery.sorts[key].defaultDirection);
    const second = animeGallery.cycleSort(first, key);
    assert.notEqual(second.direction, first.direction);
    assert.equal(animeGallery.cycleSort(second, key), null);
  }
});

test('切换排序字段时只保留新字段并从默认方向开始', () => {
  const current = { key: 'premiere', direction: 'asc' };
  assert.deepEqual(animeGallery.cycleSort(current, 'title'), { key: 'title', direction: 'asc' });
});

test('主动评分排序空值始终最后且 0 是有效值', () => {
  const desc = animeGallery.sortRows(sampleRows, { key: 'personalRating', direction: 'desc' });
  const asc = animeGallery.sortRows(sampleRows, { key: 'personalRating', direction: 'asc' });
  assert.equal(desc.at(-1).id, 'planned');
  assert.equal(asc.at(-1).id, 'planned');
  assert.equal(asc[0].id, 'paused');
});

test('主排序相同时按标题正序', () => {
  const rows = [
    row('z', { 中文名: 'Z', 个人评分: 8 }),
    row('a', { 中文名: 'A', 个人评分: 8 }),
  ];
  assert.deepEqual(titles(animeGallery.sortRows(rows, { key: 'personalRating', direction: 'desc' })), [
    'A',
    'Z',
  ]);
});

test('渐进加载先完成排序再截取前 24 条', () => {
  const rows = Array.from({ length: 30 }, (_, index) =>
    row(String(index), { 中文名: String(30 - index).padStart(2, '0') }),
  );
  const state = { ...animeGallery.createState(), sort: { key: 'title', direction: 'asc' } };
  const result = animeGallery.resolve(rows, state);
  assert.equal(result.allResults.length, 30);
  assert.equal(result.visibleRows.length, 24);
  assert.deepEqual(titles(result.visibleRows), titles(result.allResults.slice(0, 24)));
});

test('条件重置回 24，数据更新可保留并继续增加已加载数量', () => {
  const loaded = animeGallery.nextVisibleCount(24, 80);
  assert.equal(loaded, 48);
  assert.equal(animeGallery.nextVisibleCount(loaded, 50), 50);
  assert.equal(animeGallery.createState().visibleCount, 24);
});

test('清除条件保留主动排序', () => {
  const sort = { key: 'title', direction: 'desc' };
  const cleared = animeGallery.clearConditions({
    ...animeGallery.createState(),
    status: 'watching',
    favoriteOnly: true,
    unknownTotalOnly: true,
    query: 'abc',
    sort,
  });
  assert.equal(cleared.status, null);
  assert.equal(cleared.favoriteOnly, false);
  assert.equal(cleared.unknownTotalOnly, false);
  assert.equal(cleared.query, '');
  assert.equal(cleared.sort, sort);
});

test('XDB 把正式动画画廊 view 放在首位（打开默认落在动画卡片画廊）', () => {
  const definition = readLibraryContaining('agan:anime-card');
  // 只断言「动画画廊在首位且配置正确」：用户会自行增删 view、或给某个 view 挂 view 级 filter，
  // 对整个 view 对象做 deepEqual 会随用户的自定义而失败。
  const gallery = definition.views[0];
  assert.equal(gallery.id, 'anime-gallery');
  assert.equal(gallery.name, '动画卡片');
  assert.equal(gallery.type, 'agan:anime-gallery');
  assert.deepEqual(gallery.visibleFields, ['动画卡片']);
  // 全局 filter 只断言「范围＝媒体库目录」，不钉死表达式的具体写法。
  // Task 09（总媒体库画廊）按用户裁决 O1 把范围从「数据来源=Bangumi」放宽为目录范围，
  // 不变量随之变为：本库只收录 `310 媒体库` 下的笔记。
  assert.equal(definition.filter.id, 'media-scope');
  assert.equal(definition.filter.join, 'and');
  const globalExpressions = definition.filter.items
    .map((item) => item.expression)
    .join(' | ');
  assert.match(globalExpressions, /310 媒体库/u);
  assert.equal(/数据来源/u.test(globalExpressions), false, '范围不再按数据来源限定');
  // 用户把「范围=动画」从全局 filter 移到了 view 级 filter：
  // 现在同一个 .xdb 里放多个类型的画廊，类型范围由各 view 自己声明。
  const viewExpressions = (gallery.filter?.items ?? [])
    .map((item) => item.expression)
    .join(' | ');
  assert.match(viewExpressions, /作品大类/u);
  assert.match(viewExpressions, /动画/u);
});

test('画廊和 Field Renderer 调用同一共享卡片实例工厂', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '媒体库-动画卡片.xdb.js'), 'utf8');
  assert.equal((source.match(/function createAnimeCardInstance\(/gu) ?? []).length, 1);
  assert.match(source, /view: createAnimeCardInstance/u);
  assert.match(source, /instance: createAnimeCardInstance\(\)/u);
  assert.equal((source.match(/const MARKER_PATTERN/gu) ?? []).length, 1);
  assert.equal((source.match(/function renderAnimeCard\(/gu) ?? []).length, 1);
});

test('实现未注册其它媒体、新建记录或虚拟列表能力', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '媒体库-动画卡片.xdb.js'), 'utf8');
  assert.doesNotMatch(source, /newRowAction|registerAction|virtual(?:ize|List)/iu);
  assert.equal((source.match(/registerDatabaseView\(/gu) ?? []).length, 1);
  assert.match(source, /id: GALLERY_VIEW_TYPE/u);
  assert.match(source, /grid-template-rows: var\(--agan-gallery-cover-h\) auto/u);
  assert.match(source, /minmax\(min\(var\(--agan-gallery-card-min-w\), 100%\), 1fr\)/u);
  assert.match(source, /intersectionObserver\?\.disconnect\(\)/u);
  assert.match(source, /resizeObserver\?\.disconnect\(\)/u);
});
