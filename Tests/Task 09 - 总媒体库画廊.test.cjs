// Task 09 - 总媒体库画廊
//
// 依据：Plans/Task 09 - Approved Plan.md §5.5 B（28 条用例）
//
// 测试契约：
//   - 纯函数通过 `plugin.mediaGallery` / `plugin.mediaCard` 直接调用；
//   - `.xdb` 结构按扩展点 id 找库，不钉死文件名（用户会自行改名）；
//   - DOM 用最小桩，只覆盖卡片工厂与画廊实例真正用到的接口。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = require('../媒体库.xdb.js');
const { mediaCard, mediaGallery } = plugin;

const BASE = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(BASE, '媒体库.xdb.js'), 'utf8');

function readLibraryContaining(marker) {
  const candidates = fs.readdirSync(BASE).filter((name) => name.endsWith('.xdb')).sort();
  for (const name of candidates) {
    const raw = fs.readFileSync(path.join(BASE, name), 'utf8');
    if (raw.includes(marker)) return JSON.parse(raw);
  }
  throw new Error(`在 ${BASE} 下找不到含「${marker}」的 .xdb`);
}

const XDB = readLibraryContaining('agan:media-card');

// --- 样例 ---

function row(id, item) {
  return { id, $item: item };
}

// 覆盖：两种日期写法（带引号 / 裸值）、空串评分、null 日期、0 分、
// 别名类型、未归类类型、字符串 "true" 收藏、无标题行、超 5 个 tags。
const SAMPLE_ROWS = Object.freeze([
  row('m1', {
    中文名: '魔法少女奈叶 EXCEEDS',
    原名: 'Mahou Shoujo Lyrical Nanoha EXCEEDS',
    tags: ['魔法', '战斗', '百合', '科幻', '热血', '多余第六个'],
    作品大类: '动画',
    状态: '✅ 已完成',
    收藏: true,
    个人评分: 9.5,
    完成日期: '"2024-04-21"',
    cover: 'nano.png',
  }),
  row('m2', {
    中文名: '星之卡比 新星同盟',
    作品大类: '游戏',
    状态: '▶️ 进行中',
    收藏: false,
    个人评分: 0,
    完成日期: '2021-09-05',
    tags: [],
  }),
  row('m3', {
    中文名: '未分类条目',
    作品大类: '未知',
    状态: '⏳ 待定',
    收藏: 'true',
    个人评分: '',
    完成日期: null,
  }),
  row('m4', {
    作品大类: 'Anime',
    状态: '"💭 未来也许"',
    个人评分: 6,
    完成日期: '',
  }),
  row('m5', {
    中文名: '只有名字的条目',
    name: 'name-only-row',
    description: '只存在于 description 的词：量子纠缠',
    tags: ['科学'],
    完成日期: '2023-03-01',
  }),
]);

function baseState(overrides = {}) {
  return { ...mediaGallery.createState(), ...overrides };
}

// --- 最小 DOM 桩 ---

function createNode(tagName) {
  return {
    tagName,
    className: '',
    textContent: '',
    type: '',
    placeholder: '',
    value: '',
    hidden: false,
    src: '',
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
    remove() {
      const parent = findParent(this);
      if (parent) parent.children = parent.children.filter((child) => child !== this);
    },
  };
}

let lastRenderedRoot = null;
function findParent(node) {
  if (lastRenderedRoot === null) return null;
  const queue = [lastRenderedRoot];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const child of current.children ?? []) {
      if (child === node) return current;
      queue.push(child);
    }
  }
  return null;
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

function renderCard(item) {
  const captured = installCapture();
  const card = captured.renderer.view();
  const container = createNode('div');
  lastRenderedRoot = container;
  withFakeDocument(() => {
    card.onUpdate({ container, row: row('card-x', item) });
  });
  return container.children[0];
}

function renderGallery(rows) {
  const captured = installCapture();
  const gallery = captured.view.view();
  const container = createNode('div');
  lastRenderedRoot = container;
  withFakeDocument(() => {
    gallery.onUpdate({ container, viewData: rows === null ? undefined : { groups: [{ rows }] } });
  });
  return container;
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

function descendants(root) {
  const found = [];
  const queue = [root];
  while (queue.length > 0) {
    const node = queue.shift();
    found.push(node);
    queue.push(...(node.children ?? []));
  }
  return found;
}

// --- 1. 注册契约与导出面 ---

test('install() 注册 agan:media-card 字段类型、只读渲染器与 agan:media-gallery View', () => {
  const captured = installCapture();

  assert.notEqual(captured.fieldType, null, 'install() 必须注册字段类型');
  assert.equal(captured.fieldType.type, 'agan:media-card');
  assert.equal(captured.fieldType.label, '媒体卡片');
  assert.equal(captured.fieldType.order, 103);

  assert.notEqual(captured.renderer, null, 'install() 必须注册字段渲染器');
  assert.equal(captured.renderer.match({ field: { type: 'agan:media-card' } }), true);
  assert.equal(captured.renderer.match({ field: { type: 'agan:anime-card' } }), false);
  assert.equal(captured.renderer.isValueEmpty(), false, '功能字段必须显式声明非空');

  assert.notEqual(captured.view, null, 'install() 必须注册 Database View');
  assert.equal(captured.view.id, 'agan:media-gallery');
  assert.equal(captured.view.name, '总媒体库');
  assert.equal(captured.view.icon, 'gallery-horizontal');
  assert.equal(typeof captured.view.view, 'function');

  assert.equal(captured.styleSheets, 1, '样式必须集中注册一次');
});

test('纯函数导出面完整（Approved Plan §5.3）', () => {
  const expected = [
    'batchSize',
    'typeKeys',
    'typeOrder',
    'statuses',
    'statusButtonOrder',
    'statusButtonLabels',
    'statusLabels',
    'statusLabel',
    'sorts',
    'sortOrder',
    'collectRows',
    'createState',
    'toggleType',
    'toggleFavorite',
    'toggleStatus',
    'setStatusAll',
    'cycleSort',
    'clearConditions',
    'normalizeType',
    'normalizeStatus',
    'normalizeDate',
    'normalizeRating',
    'itemTitle',
    'filterRows',
    'sortRows',
    'countRows',
    'resolve',
    'nextVisibleCount',
  ];
  for (const key of expected) {
    assert.ok(key in mediaGallery, `mediaGallery 缺少 ${key}`);
  }
  assert.equal(mediaGallery.batchSize, 24);
  assert.equal(plugin.id, 'agan-media-library');
  assert.equal(plugin.version, '1.0.0');
});

// --- 2. 类型映射 ---

test('类型映射表：六中文值 + 英文别名 → 类型 key，其余一律未归类', () => {
  const cases = [
    ['动画', 'anime'],
    ['游戏', 'game'],
    ['剧集', 'series'],
    ['电影', 'movie'],
    ['书籍', 'book'],
    ['漫画', 'comic'],
    ['anime', 'anime'],
    ['game', 'game'],
    ['comic', 'comic'],
    ['"动画"', 'anime'],
  ];
  for (const [value, expected] of cases) {
    assert.equal(mediaGallery.normalizeType(value), expected, `${value} 应映射为 ${expected}`);
  }

  for (const value of ['电视剧', '未知', '{{metadata.mediaType}}', '', null, undefined, '黄油']) {
    assert.equal(mediaGallery.normalizeType(value), null, `${String(value)} 不得归入任何类型`);
  }
});

test('类型多选内部 OR，空选择集等于全部行', () => {
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ types: ['anime', 'game'] })).map((r) => r.id),
    ['m1', 'm2', 'm4'],
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ types: ['book'] })).map((r) => r.id),
    [],
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ types: [] })).map((r) => r.id),
    ['m1', 'm2', 'm3', 'm4', 'm5'],
  );
});

test('「全部」清空类型选择：逐项点掉后回到空集', () => {
  let state = baseState();
  state = mediaGallery.toggleType(state, 'anime');
  state = mediaGallery.toggleType(state, 'game');
  assert.deepEqual(state.types, ['anime', 'game']);
  state = mediaGallery.toggleType(state, 'anime');
  state = mediaGallery.toggleType(state, 'game');
  assert.deepEqual(state.types, []);
});

test('未归类不得冒名：选 anime 时别名 Anime 在、未知类型不在；空选择集两者都在', () => {
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ types: ['anime'] })).map((r) => r.id),
    ['m1', 'm4'],
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ types: ['anime', 'game'] })).map((r) => r.id),
    ['m1', 'm2', 'm4'],
  );
  assert.ok(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState()).some((r) => r.id === 'm3'),
    '空选择集必须能看到未归类行',
  );
});

// --- 3. 状态 ---

test('状态单选可恢复：再点当前项回「全部」，点「全部」也回 null', () => {
  let state = baseState();
  state = mediaGallery.toggleStatus(state, 'planned');
  assert.equal(state.status, 'planned');
  assert.equal(mediaGallery.toggleStatus(state, 'planned').status, null);
  assert.equal(mediaGallery.toggleStatus(state, 'watching').status, 'watching');
  assert.equal(mediaGallery.setStatusAll(mediaGallery.toggleStatus(state, 'completed')).status, null);
});

test('状态值带引号也能匹配，且按钮顺序固定为 待定/进行中/已完成/暂缓', () => {
  assert.equal(mediaGallery.normalizeStatus('"⏳ 待定"'), 'planned');
  assert.equal(mediaGallery.normalizeStatus('"💭 未来也许"'), 'paused');
  assert.equal(mediaGallery.normalizeStatus('✅ 已完成'), 'completed');
  assert.equal(mediaGallery.normalizeStatus('进行中'), null);

  assert.deepEqual([...mediaGallery.statusButtonOrder], ['planned', 'watching', 'completed', 'paused']);
  assert.deepEqual(
    mediaGallery.statusButtonOrder.map((key) => mediaGallery.statusButtonLabels[key]),
    ['待定', '进行中', '已完成', '暂缓'],
  );

  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ status: 'planned' })).map((r) => r.id),
    ['m3'],
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ status: 'paused' })).map((r) => r.id),
    ['m4'],
  );
});

test('收藏只有 === true 才通过：false、缺失、"true" 字符串都不通过', () => {
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ favoriteOnly: true })).map((r) => r.id),
    ['m1'],
  );
  assert.equal(mediaCard.isFavorite(true), true);
  assert.equal(mediaCard.isFavorite(false), false);
  assert.equal(mediaCard.isFavorite('true'), false);
  assert.equal(mediaCard.isFavorite(undefined), false);
});

// --- 4. 搜索 ---

test('搜索字段范围只有 中文名/原名/tags，不搜 name 与 description', () => {
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '量子纠缠' })).map((r) => r.id),
    [],
    'description 中的词不得被命中',
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: 'name-only-row' })).map((r) => r.id),
    [],
    'name 不得被搜索',
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '魔法' })).map((r) => r.id),
    ['m1'],
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: 'Lyrical' })).map((r) => r.id),
    ['m1'],
    '原名必须参与搜索',
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '科学' })).map((r) => r.id),
    ['m5'],
    'tags 必须参与搜索',
  );
});

test('搜索多词 AND，且每个词可命中不同字段', () => {
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '魔法 战斗' })).map((r) => r.id),
    ['m1'],
    '同一条记录的两个 tags',
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '奈叶 魔法' })).map((r) => r.id),
    ['m1'],
    '一个词命中中文名、另一个命中 tags',
  );
  assert.deepEqual(
    mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '魔法 卡比' })).map((r) => r.id),
    [],
    '两个词分别只命中不同记录时不通过',
  );
});

test('搜索忽略大小写与首尾空格，多空格等价于单词分隔', () => {
  const upper = mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: 'EXCEEDS' })).map((r) => r.id);
  const lower = mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: 'exceeds' })).map((r) => r.id);
  assert.deepEqual(upper, ['m1']);
  assert.deepEqual(lower, upper);

  const padded = mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '  魔法   战斗  ' })).map((r) => r.id);
  const plain = mediaGallery.filterRows(SAMPLE_ROWS, baseState({ query: '魔法 战斗' })).map((r) => r.id);
  assert.deepEqual(padded, plain);
  assert.deepEqual(padded, ['m1']);
});

// --- 5. 排序 ---

test('默认排序：完成日期降序 → 评分降序 → 标题 → row.id，无效日期全部在末尾', () => {
  const sorted = mediaGallery.sortRows(SAMPLE_ROWS, null).map((r) => r.id);
  // m1 2024-04-21 > m5 2023-03-01 > m2 2021-09-05；m3(空) m4(空) 无有效日期排最后。
  assert.deepEqual(sorted, ['m1', 'm5', 'm2', 'm4', 'm3']);
  assert.deepEqual(sorted.slice(-2).sort(), ['m3', 'm4'], '无效日期必须全部落在末尾');
});

test('完成日期排序升降序都不把空值翻到前面', () => {
  const desc = mediaGallery.sortRows(SAMPLE_ROWS, { key: 'completionDate', direction: 'desc' }).map((r) => r.id);
  const asc = mediaGallery.sortRows(SAMPLE_ROWS, { key: 'completionDate', direction: 'asc' }).map((r) => r.id);

  assert.deepEqual(desc, ['m1', 'm5', 'm2', 'm4', 'm3']);
  assert.deepEqual(asc, ['m2', 'm5', 'm1', 'm4', 'm3']);
  assert.deepEqual(asc.slice(-2).sort(), ['m3', 'm4'], '升序时空值仍在末尾');
  assert.deepEqual(desc.slice(-2).sort(), ['m3', 'm4'], '降序时空值仍在末尾');
});

test('评分排序：0 参与排序且排在 1 之前（不是空值），空串评分排末尾', () => {
  const rows = [
    row('r0', { 中文名: '零分', 个人评分: 0 }),
    row('r1', { 中文名: '一分', 个人评分: 1 }),
    row('r9', { 中文名: '九分', 个人评分: 9 }),
    row('re', { 中文名: '空分', 个人评分: '' }),
  ];

  assert.deepEqual(
    mediaGallery.sortRows(rows, { key: 'personalRating', direction: 'desc' }).map((r) => r.id),
    ['r9', 'r1', 'r0', 're'],
  );
  assert.deepEqual(
    mediaGallery.sortRows(rows, { key: 'personalRating', direction: 'asc' }).map((r) => r.id),
    ['r0', 'r1', 'r9', 're'],
  );
  assert.equal(mediaGallery.normalizeRating(0), 0, '0 必须是有效值');
});

test('稳定次级：同日期同行评分时由标题与 row.id 决定，两次排序逐元素相等', () => {
  const rows = [
    row('z', { 中文名: '乙', 个人评分: 8, 完成日期: '2024-01-01' }),
    row('a', { 中文名: '甲', 个人评分: 8, 完成日期: '2024-01-01' }),
    row('m', { 中文名: '丙', 个人评分: 8, 完成日期: '2024-01-01' }),
  ];

  const first = mediaGallery.sortRows(rows, null);
  const second = mediaGallery.sortRows(rows, null);
  assert.deepEqual(first.map((r) => r.id), second.map((r) => r.id), '同一输入必须给出确定顺序');
  assert.equal(new Set(first.map((r) => r.id)).size, 3);

  const sameTitle = mediaGallery.sortRows(
    [row('b', { 中文名: '同名' }), row('a', { 中文名: '同名' })],
    null,
  );
  assert.deepEqual(sameTitle.map((r) => r.id), ['a', 'b'], '标题相同时按 row.id 升序兜底');
});

test('缺标题的行不会让排序崩掉，itemTitle 回落为「未命名」', () => {
  const rows = [row('x', {}), row('y', { 原名: '原名兜底' }), row('z', { name: 'name 兜底' })];
  assert.equal(mediaGallery.itemTitle({}), '未命名');
  assert.equal(mediaGallery.itemTitle({ 原名: 'x' }), 'x');
  assert.equal(mediaCard.resolveTitle({ name: 'n' }), 'n');
  assert.equal(mediaGallery.sortRows(rows, null).length, 3);
  assert.equal(mediaGallery.sortRows(rows, { key: 'personalRating', direction: 'desc' }).length, 3);
});

// --- 6. 卡片渲染 ---

test('卡片降级：无封面/无标题/无评分/无日期/无标签/无类型/无状态都不留空胶囊', () => {
  const bare = renderCard({});
  assert.notEqual(find(bare, 'aganMediaCard--CoverPlaceholder'), null, '无封面必须渲染占位');
  assert.equal(find(bare, 'aganMediaCard--Cover'), null, '无封面不得渲染 img');
  assert.equal(find(bare, 'aganMediaCard--TypeBadge'), null, '无类型不得渲染类型角标');
  assert.equal(find(bare, 'aganMediaCard--StatusBadge'), null, '无状态不得渲染状态角标');
  assert.equal(find(bare, 'aganMediaCard--DateBadge'), null, '无日期不得渲染日期角标');
  assert.equal(find(bare, 'aganMediaCard--RatingBadge'), null, '无评分不得渲染评分角标');
  assert.equal(find(bare, 'aganMediaCard--Tags'), null, '无 tags 不得渲染标签行');
  assert.equal(find(bare, 'aganMediaCard--Title').textContent, '未命名');

  const full = renderCard(SAMPLE_ROWS[0].$item);
  assert.notEqual(find(full, 'aganMediaCard--TypeBadge'), null);
  assert.equal(find(full, 'aganMediaCard--TypeBadge').textContent, '动画');
  assert.equal(find(full, 'aganMediaCard--StatusBadge').textContent, '已看');
  assert.equal(find(full, 'aganMediaCard--DateBadge').textContent, '2024年04月');
  assert.equal(find(full, 'aganMediaCard--RatingBadge').textContent, '★ 9.5');
  assert.ok(find(full, 'aganMediaCard--Title').textContent.startsWith('★ '), '收藏为 true 时标题前必须有 ★');
  assert.equal(findAll(full, 'aganMediaCard--Tag').length, 5, '标签最多渲染 5 个');

  const notFavorite = renderCard({ 中文名: '不收藏', 收藏: false });
  assert.equal(find(notFavorite, 'aganMediaCard--Title').textContent, '不收藏');
});

test('状态词按类型映射：动画/游戏各用专属词，未确认类型与未归类回落中性词', () => {
  const label = (type, status) => {
    const card = renderCard({ 中文名: 'x', 作品大类: type, 状态: status });
    return find(card, 'aganMediaCard--StatusBadge').textContent;
  };

  assert.equal(label('动画', '⏳ 待定'), '想看');
  assert.equal(label('动画', '▶️ 进行中'), '在看');
  assert.equal(label('动画', '✅ 已完成'), '已看');
  assert.equal(label('游戏', '⏳ 待定'), '想玩');
  assert.equal(label('游戏', '▶️ 进行中'), '在玩');
  assert.equal(label('游戏', '✅ 已完成'), '已玩');

  assert.equal(label('电影', '⏳ 待定'), '待定', '未批准类型必须用中性词');
  assert.equal(label('剧集', '✅ 已完成'), '已完成');
  assert.equal(label(null, '▶️ 进行中'), '进行中', '未归类必须用中性词');
  assert.equal(label('未知', '✅ 已完成'), '已完成');

  for (const type of ['动画', '游戏', '电影', null]) {
    assert.equal(label(type, '💭 未来也许'), '暂缓', `${String(type)} 的 paused 都应是「暂缓」`);
  }
});

test('筛选按钮恒为中性词，不含 想看/在看/想玩/在玩', () => {
  const container = renderGallery(SAMPLE_ROWS);

  const labels = findAll(container, 'aganMediaGallery--FilterButton').map((node) => node.textContent);
  assert.deepEqual(labels, ['全部', '动画', '游戏', '剧集', '电影', '书籍', '漫画', '全部', '待定', '进行中', '已完成', '暂缓']);
  for (const banned of ['想看', '在看', '想玩', '在玩']) {
    assert.equal(labels.includes(banned), false, `筛选按钮不得出现「${banned}」`);
  }
});

test('评分 0 渲染出评分角标文本 0', () => {
  const card = renderCard({ 中文名: '零分作品', 个人评分: 0 });
  const badge = find(card, 'aganMediaCard--RatingBadge');
  assert.notEqual(badge, null, '0 分必须渲染角标');
  assert.equal(badge.textContent, '★ 0');
});

// --- 7. 只读与静态约束 ---

test('卡片只读：DOM 内没有表单控件，也没有简介/推荐语/产地/进度/游玩/集数文本', () => {
  const card = renderCard({ 中文名: '只读检查', '作品大类': '动画', 状态: '✅ 已完成', 个人评分: 8 });
  for (const tag of ['input', 'textarea', 'select', 'button']) {
    assert.equal(descendants(card).some((node) => node.tagName === tag), false, `卡片内不得有 ${tag}`);
  }

  const text = collectText(card).join(' ');
  for (const banned of ['简介', '推荐语', '产地', '进度', '游玩', '集数', '已看集数']) {
    assert.equal(text.includes(banned), false, `卡片文本不得包含「${banned}」`);
  }
});

test('源码静态断言：无写回 API、无模态、不引用其它两个插件的类名', () => {
  assert.equal(/updateCell|updateRow|updateCells|deleteRow|deleteRows|createRow|setRowValue/u.test(SOURCE), false);
  assert.equal(/markdown\.(replace|create)/u.test(SOURCE), false);
  assert.equal(/Modal/u.test(SOURCE), false);
  assert.equal(/aganAnimeCard--|aganAnimeMediaProgress--|aganGameCard--|aganGameGallery--/u.test(SOURCE), false);
  assert.equal(/开播日期|发行日期|游玩分钟|游玩平台|总集数|Media Progress/u.test(SOURCE), false);
});

test('样式前缀只允许 aganMediaCard 与 aganMediaGallery', () => {
  const prefixes = new Set(
    Array.from(SOURCE.matchAll(/\.([A-Za-z][\w-]*)--/gu), (match) => match[1]),
  );
  assert.deepEqual([...prefixes].sort(), ['aganMediaCard', 'aganMediaGallery']);
  assert.equal(SOURCE.includes('components--'), false, '不得使用宿主保留前缀');
});

// --- 8. 条件变化重算与空状态 ---

test('条件变化后从第一批完整重算，不是只过滤已渲染卡片', () => {
  const rows = [];
  for (let index = 0; index < 48; index += 1) {
    rows.push(row(`p${index}`, { 中文名: '批量条目', '作品大类': '动画' }));
  }
  rows.push(row('p48', { 中文名: '特殊条目', '作品大类': '动画' }));

  const before = mediaGallery.resolve(rows, baseState({ visibleCount: 48 }));
  assert.equal(before.allResults.length, 49);
  assert.equal(before.visibleRows.length, 48);
  assert.equal(before.visibleRows.some((r) => r.id === 'p48'), false, '第 49 条此时不可见');

  const after = mediaGallery.resolve(rows, baseState({ query: '特殊', visibleCount: mediaGallery.batchSize }));
  assert.equal(after.allResults.length, 1);
  assert.equal(after.visibleRows.length, 1, '条件变化后必须回到第 1 批');
  assert.equal(after.visibleRows[0].id, 'p48', '必须能命中未渲染过的第 49 条');
});

test('区分两种空：集合无记录 vs 条件无匹配，文案不同', () => {
  const emptyCollection = mediaGallery.resolve([], baseState());
  assert.equal(emptyCollection.isEmptyCollection, true);
  assert.equal(emptyCollection.isEmptyResult, false);

  const emptyResult = mediaGallery.resolve(SAMPLE_ROWS, baseState({ query: '不存在的词' }));
  assert.equal(emptyResult.isEmptyCollection, false);
  assert.equal(emptyResult.isEmptyResult, true);

  assert.notEqual(mediaGallery.emptyCollectionMessage, mediaGallery.emptyResultMessage);

  const container = renderGallery(SAMPLE_ROWS);
  const search = find(container, 'aganMediaGallery--Search');
  const typeButton = findAll(container, 'aganMediaGallery--FilterButton')[2];
  assert.notEqual(search, null);
  assert.equal(typeButton.textContent, '游戏');
  assert.equal(findAll(container, 'aganMediaCard--Root').length, SAMPLE_ROWS.length);

  const emptyContainer = renderGallery([]);
  assert.notEqual(find(emptyContainer, 'aganMediaGallery--EmptyTitle'), null);
  assert.equal(
    find(emptyContainer, 'aganMediaGallery--EmptyTitle').textContent,
    mediaGallery.emptyCollectionMessage,
  );
  assert.equal(find(emptyContainer, 'aganMediaCard--Root'), null, '空集合不渲染卡片');
});

test('clearConditions 清掉类型/状态/收藏/搜索但保留排序', () => {
  const state = baseState({
    types: ['anime'],
    status: 'completed',
    favoriteOnly: true,
    query: '魔法',
    sort: { key: 'personalRating', direction: 'asc' },
  });
  const cleared = mediaGallery.clearConditions(state);

  assert.deepEqual(cleared.types, []);
  assert.equal(cleared.status, null);
  assert.equal(cleared.favoriteOnly, false);
  assert.equal(cleared.query, '');
  assert.deepEqual(cleared.sort, { key: 'personalRating', direction: 'asc' }, '排序必须保留');
});

// --- 9. 分批与计数 ---

test('nextVisibleCount 每批 24 且不超过总数', () => {
  assert.equal(mediaGallery.nextVisibleCount(24, 61), 48);
  assert.equal(mediaGallery.nextVisibleCount(48, 61), 61);
  assert.equal(mediaGallery.nextVisibleCount(24, 10), 10);
});

test('countRows 恒基于全集合，不随筛选与分页改变', () => {
  const counts = mediaGallery.countRows(SAMPLE_ROWS);
  assert.equal(counts.all, 5);
  assert.equal(counts.favorite, 1, '字符串 "true" 不算收藏');
  assert.equal(counts.anime, 2);
  assert.equal(counts.game, 1);
  assert.equal(counts.unclassified, 2);
  assert.equal(counts.planned, 1);
  assert.equal(counts.watching, 1);
  assert.equal(counts.completed, 1);
  assert.equal(counts.paused, 1);

  const resolved = mediaGallery.resolve(SAMPLE_ROWS, baseState({ types: ['game'], visibleCount: 1 }));
  assert.equal(resolved.counts.all, 5, '计数不因筛选而变小');
  assert.equal(resolved.allResults.length, 1);
  assert.equal(resolved.visibleRows.length, 1);
});

// --- 10. .xdb 结构 ---

test('媒体库单个视图.xdb 增加了媒体卡片字段与总媒体库 View，且既有 View 未被改动', () => {
  assert.equal(XDB.source, 'file');

  const cardField = XDB.fields.find((field) => field.name === '媒体卡片');
  assert.ok(cardField, 'fields 里应有「媒体卡片」');
  assert.equal(cardField.type, 'agan:media-card');

  const gallery = XDB.views.find((view) => view.type === 'agan:media-gallery');
  assert.ok(gallery, 'views 里应有 agan:media-gallery');
  assert.equal(gallery.id, 'agan:media-gallery');
  assert.equal(gallery.name, '总媒体库');
  assert.deepEqual(gallery.visibleFields, ['媒体卡片']);
  assert.equal(gallery.filter, undefined, '总集合 View 不得再写自己的 filter');
  assert.equal(gallery.sort, undefined);
  assert.equal(gallery.group, undefined);
  assert.equal(gallery.limit, undefined);

  const animeView = XDB.views.find((view) => view.type === 'agan:anime-gallery');
  assert.ok(animeView);
  assert.deepEqual(animeView.visibleFields, ['动画卡片']);
  const gameView = XDB.views.find((view) => view.type === 'agan:game-gallery');
  assert.ok(gameView);
  assert.deepEqual(gameView.visibleFields, ['游戏卡片']);
  assert.equal(XDB.views.length, 3);
  assert.deepEqual(XDB.rootGroup, { type: 'tabs' });

  assert.equal(XDB.filter.type, 'group');
  assert.equal(XDB.filter.join, 'and');
  const expressions = (XDB.filter.items ?? []).map((item) => item.expression).join(' | ');
  assert.match(expressions, /310 媒体库/u, '范围必须由目录决定');
  assert.equal(/数据来源/u.test(expressions), false, '范围不得再按数据来源限定');
});
