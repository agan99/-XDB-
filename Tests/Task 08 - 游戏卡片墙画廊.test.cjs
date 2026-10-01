const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = require('../媒体库-游戏卡片.xdb.js');
const { gameCard, gameGallery } = plugin;

const BASE = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(BASE, '媒体库-游戏卡片.xdb.js'), 'utf8');

// 用户会自行给 .xdb 改名，所以按扩展点 id 去找库，不钉死文件名。
function readLibraryContaining(marker) {
  const candidates = fs.readdirSync(BASE).filter((name) => name.endsWith('.xdb')).sort();
  for (const name of candidates) {
    const raw = fs.readFileSync(path.join(BASE, name), 'utf8');
    if (raw.includes(marker)) return JSON.parse(raw);
  }
  throw new Error(`在 ${BASE} 下找不到含「${marker}」的 .xdb`);
}

const XDB = readLibraryContaining('agan:game-card');

// --- 样例 ---

function row(id, item) {
  return { id, $item: item };
}

const SAMPLE_ROWS = Object.freeze([
  row('g1', {
    中文名: '接线疑云',
    原名: 'The Operator',
    状态: '▶️ 进行中',
    发行日期: '2024-07-22',
    个人评分: 6.5,
    游玩分钟: 150,
    收藏: false,
    tags: ['', '解谜', '推理'],
  }),
  row('g2', {
    中文名: '星之卡比 新星同盟',
    状态: '⏳ 待定',
    发行日期: '2025-01-10',
    个人评分: 8,
    游玩分钟: null,
    收藏: true,
    tags: ['ACT'],
  }),
  row('g3', {
    中文名: '空洞骑士',
    状态: '✅ 已完成',
    发行日期: '2020-03-01',
    个人评分: 7,
    游玩分钟: 0,
    收藏: false,
    tags: ['独立游戏'],
  }),
  row('g4', {
    中文名: '空之轨迹',
    原名: 'Trails',
    状态: '💭 未来也许',
    发行日期: '2022-12-31',
    个人评分: null,
    游玩分钟: 'abc',
    收藏: false,
    tags: [],
  }),
]);

// --- 最小 DOM 桩：只覆盖画廊与卡片渲染用到的接口 ---

function createNode(tagName) {
  return {
    tagName,
    className: '',
    textContent: '',
    type: '',
    placeholder: '',
    value: '',
    hidden: false,
    dataset: {},
    attributes: {},
    children: [],
    style: {
      properties: {},
      setProperty(name, value) {
        this.properties[name] = value;
      },
    },
    clientWidth: 0,
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    insertBefore(node, reference) {
      const index = this.children.indexOf(reference);
      if (index === -1) this.children.push(node);
      else this.children.splice(index, 0, node);
      return node;
    },
    addEventListener() {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    getAttribute(name) {
      return this.attributes[name];
    },
    remove() {},
  };
}

function withFakeDocument(run) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: createNode,
    createDocumentFragment: () => createNode('fragment'),
  };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

function installCapture() {
  const captured = { fieldType: null, renderer: null, view: null, styleSheets: 0 };
  plugin.install({
    registerFieldType: (extension) => {
      captured.fieldType = extension;
      return true;
    },
    registerFieldRenderer: (extension) => {
      captured.renderer = extension;
    },
    registerDatabaseView: (extension) => {
      captured.view = extension;
    },
    registerStyleSheet: () => {
      captured.styleSheets += 1;
    },
  });
  return captured;
}

function classNames(node) {
  return String(node.className).split(/\s+/u).filter((name) => name !== '');
}

function findAll(root, className) {
  const found = [];
  const queue = [root];
  while (queue.length > 0) {
    const node = queue.shift();
    if (classNames(node).includes(className)) found.push(node);
    queue.push(...(node.children ?? []));
  }
  return found;
}

function find(root, className) {
  return findAll(root, className)[0] ?? null;
}

function collectText(root) {
  const parts = [];
  if (typeof root.textContent === 'string' && root.textContent !== '') parts.push(root.textContent);
  for (const child of root.children ?? []) parts.push(...collectText(child));
  return parts;
}

// --- 1. 注册契约 ---

test('install() 注册游戏卡片墙 Database View', () => {
  const captured = installCapture();

  assert.notEqual(captured.view, null, 'install() 必须注册 Database View');
  assert.equal(captured.view.id, 'agan:game-gallery');
  assert.equal(captured.view.name, '游戏卡片墙');
  assert.equal(captured.view.icon, 'layoutGrid');
  assert.equal(typeof captured.view.view, 'function');
  assert.equal(captured.styleSheets, 1, '样式必须集中注册一次');
});

test('插件版本已推进到 1.2.0 且导出 gameGallery', () => {
  assert.equal(plugin.version, '1.2.0');
  assert.equal(plugin.id, 'agan-game-card');
  assert.equal(typeof gameGallery.resolve, 'function');
});

// --- 2. 常量与状态表 ---

test('画廊常量与动画侧同构（批量 24、卡宽 330×400、最小 210、间距 12）', () => {
  assert.equal(gameGallery.batchSize, 24);

  assert.match(SOURCE, /const GALLERY_VIEW_TYPE = 'agan:game-gallery'/u);
  assert.match(SOURCE, /const GALLERY_CARD_WIDTH = 330/u);
  assert.match(SOURCE, /const GALLERY_COVER_HEIGHT = 400/u);
  assert.match(SOURCE, /const GALLERY_CARD_MIN_WIDTH = 210/u);
  assert.match(SOURCE, /const GALLERY_GRID_GAP = 12/u);
});

test('四态状态与动画侧同源，文案改为 在玩/想玩/已玩/暂缓', () => {
  assert.deepEqual(gameGallery.statuses, {
    watching: '▶️ 进行中',
    planned: '⏳ 待定',
    completed: '✅ 已完成',
    paused: '💭 未来也许',
  });

  for (const label of ['在玩', '想玩', '已玩', '暂缓']) {
    assert.ok(SOURCE.includes(label), `画廊缺少状态按钮文案 ${label}`);
  }
});

test('排序键是 发行日期/个人评分/标题，不含 开播日期', () => {
  assert.deepEqual(Object.keys(gameGallery.sorts), ['release', 'personalRating', 'title']);
  assert.equal(gameGallery.sorts.release.field, '发行日期');
  assert.equal(gameGallery.sorts.release.defaultDirection, 'desc');
  assert.equal(gameGallery.sorts.personalRating.field, '个人评分');
  assert.equal(gameGallery.sorts.title.field, null);
  assert.equal(gameGallery.sorts.title.defaultDirection, 'asc');

  assert.equal(SOURCE.includes('开播日期'), false, '游戏侧不得沿用动画的开播日期');
});

// --- 3. XDB 配置 ---

test('媒体库把游戏卡片墙画廊配置齐全', () => {
  // 用户把动画库与游戏库合并成一个 .xdb（媒体库单个视图.xdb），并会自行改 view 的 id 与名字
  // （原有的 game-card-table 已被用户移除），所以只按扩展点 id 找 view。
  const gallery = XDB.views.find((view) => view.type === 'agan:game-gallery');
  assert.ok(gallery, '游戏卡片墙 view 应存在');
  assert.deepEqual(gallery.visibleFields, ['游戏卡片']);

  // 类型范围由各 view 自己声明，全局 filter 只留数据来源。
  const expressions = (gallery.filter?.items ?? []).map((item) => item.expression).join(' | ');
  assert.match(expressions, /作品大类/u);
  assert.match(expressions, /游戏/u);
});

test('媒体库的游戏画廊只渲染游戏卡片，不借用动画字段', () => {
  assert.equal(XDB.source, 'file');
  // 合并库的全局 filter 只声明「范围＝310 媒体库 目录」，游戏范围在 view 级 filter 里。
  // Task 09 按用户裁决 O1 把范围从「数据来源=Bangumi」放宽为目录范围。
  assert.equal(XDB.filter.join, 'and');
  const globalExpressions = XDB.filter.items.map((item) => item.expression).join(' | ');
  assert.match(globalExpressions, /310 媒体库/u);
  assert.equal(/数据来源/u.test(globalExpressions), false, '范围不再按数据来源限定');

  const cardField = XDB.fields.find((field) => field.name === '游戏卡片');
  assert.equal(cardField.type, 'agan:game-card');

  const gallery = XDB.views.find((view) => view.type === 'agan:game-gallery');
  assert.ok(gallery, '游戏卡片墙 view 应存在');
  assert.deepEqual(gallery.visibleFields, ['游戏卡片']);
  assert.equal(gallery.visibleFields.includes('动画卡片'), false);
  assert.equal(JSON.stringify(XDB).includes('game-gallery-wall'), false);
});

// --- 4. 纯函数契约 ---

test('collectRows 递归展开分组并按 id 去重', () => {
  const rows = gameGallery.collectRows([
    { rows: [row('a', {}), row('b', {})], groups: [{ rows: [row('b', {}), row('c', {})] }] },
  ]);

  assert.deepEqual(rows.map((entry) => entry.id), ['a', 'b', 'c']);
  assert.deepEqual(gameGallery.collectRows(undefined), []);
});

test('createState 初值符合规范', () => {
  assert.deepEqual(gameGallery.createState(), {
    status: null,
    favoriteOnly: false,
    unknownPlaytimeOnly: false,
    query: '',
    sort: null,
    visibleCount: 24,
  });
});

test('toggleStatus 是单选，重复点击同一个状态即取消', () => {
  const state = gameGallery.createState();
  const watching = gameGallery.toggleStatus(state, 'watching');
  assert.equal(watching.status, 'watching');
  assert.equal(gameGallery.toggleStatus(watching, 'watching').status, null);
  assert.equal(gameGallery.toggleStatus(watching, 'planned').status, 'planned');
});

test('cycleSort 三态循环：默认方向 → 反向 → 取消', () => {
  assert.deepEqual(gameGallery.cycleSort(null, 'release'), { key: 'release', direction: 'desc' });
  assert.deepEqual(gameGallery.cycleSort({ key: 'release', direction: 'desc' }, 'release'), {
    key: 'release',
    direction: 'asc',
  });
  assert.equal(gameGallery.cycleSort({ key: 'release', direction: 'asc' }, 'release'), null);

  assert.deepEqual(gameGallery.cycleSort(null, 'title'), { key: 'title', direction: 'asc' });
  assert.deepEqual(gameGallery.cycleSort({ key: 'title', direction: 'asc' }, 'title'), {
    key: 'title',
    direction: 'desc',
  });

  const current = { key: 'release', direction: 'desc' };
  assert.deepEqual(gameGallery.cycleSort(current, 'title'), { key: 'title', direction: 'asc' });
  assert.deepEqual(gameGallery.cycleSort(current, 'nope'), current);
});

test('clearConditions 清掉筛选与搜索但保留排序', () => {
  const cleared = gameGallery.clearConditions({
    status: 'watching',
    favoriteOnly: true,
    unknownPlaytimeOnly: true,
    query: ' 卡比 ',
    sort: { key: 'title', direction: 'asc' },
    visibleCount: 48,
  });

  assert.deepEqual(cleared, {
    status: null,
    favoriteOnly: false,
    unknownPlaytimeOnly: false,
    query: '',
    sort: { key: 'title', direction: 'asc' },
    visibleCount: 48,
  });
});

test('时长未知的判据与卡片「已游玩」行同源', () => {
  for (const value of [undefined, null, '', 'abc', -1, 1.5]) {
    assert.equal(gameGallery.isUnknownPlaytime({ 游玩分钟: value }), true, `${String(value)} 应视为未知`);
  }
  for (const value of [0, 150, '60']) {
    assert.equal(gameGallery.isUnknownPlaytime({ 游玩分钟: value }), false, `${String(value)} 应是有效记录`);
  }

  // 与卡片侧换算保持一致
  assert.equal(gameCard.formatPlaytime(150), '2小时30分');
  assert.equal(gameCard.formatPlaytime(0), '0分钟');
  assert.equal(gameCard.formatPlaytime('abc'), null);
});

test('countRows 的数量恒基于全库', () => {
  assert.deepEqual(gameGallery.countRows(SAMPLE_ROWS), {
    all: 4,
    watching: 1,
    planned: 1,
    completed: 1,
    paused: 1,
    favorite: 1,
    unknownPlaytime: 2,
  });
});

test('filterRows 支持状态、收藏、时长未知与多词跨字段搜索', () => {
  const base = gameGallery.createState();

  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, { ...base, status: 'completed' }).map((entry) => entry.id),
    ['g3'],
  );
  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, { ...base, favoriteOnly: true }).map((entry) => entry.id),
    ['g2'],
  );
  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, { ...base, unknownPlaytimeOnly: true }).map((entry) => entry.id),
    ['g2', 'g4'],
  );
  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, { ...base, query: '卡比' }).map((entry) => entry.id),
    ['g2'],
  );
  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, { ...base, query: 'the operator' }).map((entry) => entry.id),
    ['g1'],
  );
  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, { ...base, query: 'trails 空之' }).map((entry) => entry.id),
    ['g4'],
  );
  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, { ...base, query: '解谜 推理' }).map((entry) => entry.id),
    ['g1'],
  );
  assert.deepEqual(
    gameGallery.filterRows(SAMPLE_ROWS, {
      ...base,
      status: 'completed',
      favoriteOnly: true,
    }).map((entry) => entry.id),
    [],
  );
});

test('默认排序：在玩 → 想玩 → 暂缓 → 已玩，同类内按发行日期倒序', () => {
  const sorted = gameGallery.sortRows(SAMPLE_ROWS, null);
  assert.deepEqual(sorted.map((entry) => entry.id), ['g1', 'g2', 'g4', 'g3']);
});

test('主动排序把空值排在最后，并允许反向', () => {
  assert.deepEqual(
    gameGallery.sortRows(SAMPLE_ROWS, { key: 'personalRating', direction: 'desc' }).map((e) => e.id),
    ['g2', 'g3', 'g1', 'g4'],
  );
  assert.deepEqual(
    gameGallery.sortRows(SAMPLE_ROWS, { key: 'personalRating', direction: 'asc' }).map((e) => e.id),
    ['g1', 'g3', 'g2', 'g4'],
  );
  assert.deepEqual(
    gameGallery.sortRows(SAMPLE_ROWS, { key: 'release', direction: 'asc' }).map((e) => e.id),
    ['g3', 'g4', 'g1', 'g2'],
  );
  const titleAsc = gameGallery
    .sortRows(SAMPLE_ROWS, { key: 'title', direction: 'asc' })
    .map((e) => e.id);
  const titleDesc = gameGallery
    .sortRows(SAMPLE_ROWS, { key: 'title', direction: 'desc' })
    .map((e) => e.id);
  assert.equal(titleAsc.length, SAMPLE_ROWS.length, '标题排序不得丢行');
  assert.equal(new Set(titleAsc).size, SAMPLE_ROWS.length, '标题排序不得重复行');
  assert.deepEqual(titleDesc, [...titleAsc].reverse(), '反向排序必须完全镜像');
});

test('缺标题的行不会让标题排序崩掉', () => {
  const rows = [row('x', { 状态: '⏳ 待定' }), row('y', { name: 'A' }), row('z', {})];
  const sorted = gameGallery.sortRows(rows, { key: 'title', direction: 'asc' });
  assert.equal(sorted.length, 3);

  const fallback = gameGallery.sortRows(rows, null);
  assert.equal(fallback.length, 3, '默认排序同样不能崩');
});

test('resolve 同时给出全库计数与分页后的可见行', () => {
  const resolved = gameGallery.resolve(SAMPLE_ROWS, {
    ...gameGallery.createState(),
    status: 'completed',
    visibleCount: 1,
  });

  assert.equal(resolved.counts.all, 4, '筛选数量必须始终统计全库');
  assert.deepEqual(resolved.allResults.map((entry) => entry.id), ['g3']);
  assert.deepEqual(resolved.visibleRows.map((entry) => entry.id), ['g3']);
});

test('nextVisibleCount 每批 24 且不超过总数', () => {
  assert.equal(gameGallery.nextVisibleCount(24, 100), 48);
  assert.equal(gameGallery.nextVisibleCount(48, 100), 72);
  assert.equal(gameGallery.nextVisibleCount(24, 30), 30);
  assert.equal(gameGallery.nextVisibleCount(24, 10), 10);
});

// --- 5. 画廊实例 ---

test('画廊实例渲染头部控件并用 gameCard 渲染卡片', () => {
  const captured = installCapture();
  const container = createNode('div');
  const root = withFakeDocument(() => {
    const instance = captured.view.view();
    instance.onUpdate({
      container,
      viewData: { groups: [{ rows: SAMPLE_ROWS }] },
    });
    return container.children[0];
  });

  assert.equal(find(root, 'aganGameGallery--Heading').textContent, '游戏卡片墙');

  const filterLabels = findAll(root, 'aganGameGallery--FilterButton').map((node) => node.textContent);
  assert.deepEqual(filterLabels, [
    '全部 4',
    '在玩 1',
    '想玩 1',
    '已玩 1',
    '暂缓 1',
    '★ 收藏 1',
    '时长未知 2',
  ]);

  const sortLabels = findAll(root, 'aganGameGallery--SortButton').map((node) => node.textContent);
  assert.deepEqual(sortLabels, ['发行日期', '个人评分', '标题']);

  const search = find(root, 'aganGameGallery--Search');
  assert.equal(search.placeholder, '搜索中文名、原名或标签');
  assert.equal(search.attributes['aria-label'], '搜索游戏');

  const canvas = find(root, 'aganGameGallery--CardCanvas');
  assert.notEqual(canvas, null, '画廊必须为每行渲染卡片画布');
  const card = find(canvas, 'aganGameCard--Root');
  assert.notEqual(card, null, '画布内必须复用游戏卡片 Renderer');
  assert.equal(card.dataset.status, 'watching');
  assert.ok(
    collectText(card).includes('接线疑云'),
    '卡片标题必须来自真实行数据',
  );
});

test('画廊只读：不写回、不复用动画画廊类名、不含进度或简介', () => {
  assert.equal(/updateCell|updateRow|setRowValue|deleteRow|createRow/u.test(SOURCE), false);
  assert.equal(/aganAnime(Gallery|Card)/u.test(SOURCE), false);

  for (const banned of ['aganGameCard--Progress', 'aganGameCard--Percentage', 'aganGameCard--Description']) {
    assert.equal(SOURCE.includes(banned), false, `游戏卡片不应包含 ${banned}`);
  }
  for (const banned of ['aganGameGallery--Progress', 'aganGameGallery--Percentage']) {
    assert.equal(SOURCE.includes(banned), false, `游戏画廊不应包含 ${banned}`);
  }
});

test('样式前缀只允许 aganGameCard 与 aganGameGallery', () => {
  const prefixes = new Set(
    Array.from(SOURCE.matchAll(/\.([A-Za-z][\w-]*)--/gu), (match) => match[1]),
  );

  assert.deepEqual([...prefixes].sort(), ['aganGameCard', 'aganGameGallery']);
});
