const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const plugin = require('../媒体库-游戏卡片.xdb.js');
const { gameCard } = plugin;

const BASE = path.join(__dirname, '..');

// 用户会自行给 .xdb 改名，所以按扩展点 id 去找库，不钉死文件名。
function readLibraryContaining(marker) {
  const candidates = fs.readdirSync(BASE).filter((name) => name.endsWith('.xdb')).sort();
  for (const name of candidates) {
    const raw = fs.readFileSync(path.join(BASE, name), 'utf8');
    if (raw.includes(marker)) return JSON.parse(raw);
  }
  throw new Error(`在 ${BASE} 下找不到含「${marker}」的 .xdb`);
}

// 真实样例：300 Resources/310 媒体库/311 游戏 🎮/学习版/接线疑云_游戏.md
const SAMPLE = Object.freeze({
  BangumiID: '491854',
  name: 'Bangumi游戏模板',
  description: '',
  作品大类: '游戏',
  中文名: '接线疑云',
  原名: 'The Operator',
  游戏类型: '解谜',
  tags: ['', '解谜', '推理', '悬疑', '独立游戏', '文字游戏'],
  制作公司: '',
  发行日期: '2024-07-22',
  cover: 'https://example.invalid/cover.jpg',
  数据来源: 'Bangumi',
  Bangumi评分: 6.8,
  状态: '✅ 已完成',
  游玩平台: '学习版',
  游玩分钟: 150,
  个人评分: 6.5,
  收藏: false,
});

// --- 最小 DOM 桩：只覆盖游戏卡片渲染用到的接口 ---

function createNode(tagName) {
  return {
    tagName,
    className: '',
    textContent: '',
    dataset: {},
    attributes: {},
    children: [],
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    addEventListener() {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    remove() {},
  };
}

function withFakeDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: createNode };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

function loadRenderer() {
  let captured = null;
  plugin.install({
    registerFieldType: () => true,
    registerFieldRenderer: (extension) => {
      captured = extension;
    },
    registerDatabaseView: () => undefined,
    registerStyleSheet: () => undefined,
  });
  assert.notEqual(captured, null, 'install() 必须注册 Field Renderer');
  return captured;
}

function classNames(node) {
  return node.className.split(/\s+/u).filter((name) => name !== '');
}

function find(root, className) {
  const queue = [root];
  while (queue.length > 0) {
    const node = queue.shift();
    if (classNames(node).includes(className)) return node;
    queue.push(...(node.children ?? []));
  }
  return null;
}

function collectText(root) {
  const parts = [];
  if (typeof root.textContent === 'string' && root.textContent !== '') parts.push(root.textContent);
  for (const child of root.children ?? []) parts.push(...collectText(child));
  return parts;
}

function renderCard(item) {
  const renderer = loadRenderer();
  const container = createNode('div');
  return withFakeDocument(() => {
    const instance = renderer.view();
    instance.onUpdate({ container, row: { $item: item } });
    return container.children[0];
  });
}

// --- 展示字段 ---

test('真实样例输出规范要求的全部展示值', () => {
  const presentation = gameCard.gameCardPresentation(SAMPLE);

  assert.equal(presentation.genre, '解谜');
  assert.equal(presentation.status, '已完成');
  assert.equal(presentation.releaseMonth, '2024年07月');
  assert.deepEqual(presentation.rating, { hasValue: true, label: '6.5' });
  assert.equal(presentation.title, '接线疑云');
  assert.equal(presentation.infoLine, '学习版 · 已游玩 2小时30分');
});

test('标签忽略空白首项、保持原顺序并封顶 5 个', () => {
  assert.deepEqual(gameCard.gameCardPresentation(SAMPLE).tags, [
    '解谜',
    '推理',
    '悬疑',
    '独立游戏',
    '文字游戏',
  ]);

  assert.deepEqual(gameCard.firstTags(['一', '', '  ', '二', '三', '四', '五', '六']), [
    '一',
    '二',
    '三',
    '四',
    '五',
  ]);
  assert.deepEqual(gameCard.firstTags([]), []);
  assert.deepEqual(gameCard.firstTags(null), []);
});

test('标题按中文名、原名、name 依次 fallback，全空时用占位', () => {
  assert.equal(gameCard.resolveGameTitle(SAMPLE), '接线疑云');
  assert.equal(gameCard.resolveGameTitle({ 中文名: ' ', 原名: 'The Operator' }), 'The Operator');
  assert.equal(gameCard.resolveGameTitle({ 中文名: '', 原名: '', name: 'raw-name' }), 'raw-name');
  assert.equal(gameCard.resolveGameTitle({}), null);

  const empty = gameCard.gameCardPresentation({});
  assert.equal(empty.title, '未命名游戏');
  assert.equal(empty.hasTitle, false);
});

test('收藏标记只在严格 true 时出现', () => {
  assert.equal(gameCard.isFavorite(true), true);
  assert.equal(gameCard.isFavorite(false), false);
  assert.equal(gameCard.isFavorite('true'), false);
  assert.equal(gameCard.isFavorite(1), false);
  assert.equal(gameCard.isFavorite(null), false);

  assert.equal(gameCard.gameCardPresentation({ 收藏: true }).favorite, true);
  assert.equal(gameCard.gameCardPresentation(SAMPLE).favorite, false);
});

test('状态去掉前置图标，非法值降级', () => {
  assert.equal(gameCard.gameStatusLabel('✅ 已完成'), '已完成');
  assert.equal(gameCard.gameStatusLabel('▶️ 进行中'), '进行中');
  assert.equal(gameCard.gameStatusLabel('💭 未来也许'), '未来也许');
  assert.equal(gameCard.gameStatusLabel('⏳ 待定'), '待定');
  assert.equal(gameCard.gameStatusLabel('已完成'), '已完成');
  assert.equal(gameCard.gameStatusLabel('  '), null);
  assert.equal(gameCard.gameStatusLabel(null), null);
});

test('状态映射到与动画侧同名的四态 key', () => {
  assert.equal(gameCard.gameStatusKey('💭 未来也许'), 'paused');
  assert.equal(gameCard.gameStatusKey('⏳ 待定'), 'planned');
  assert.equal(gameCard.gameStatusKey('▶️ 进行中'), 'watching');
  assert.equal(gameCard.gameStatusKey('✅ 已完成'), 'completed');
  assert.equal(gameCard.gameStatusKey('已完成'), 'completed');
  assert.equal(gameCard.gameStatusKey('🃏 没见过'), 'unknown');
  assert.equal(gameCard.gameStatusKey(null), 'unknown');
  assert.equal(gameCard.gameCardPresentation(SAMPLE).statusKey, 'completed');
});

test('标签配色先按语义关键词命中，再按稳定哈希兜底', () => {
  assert.equal(gameCard.tagColorKey('推理'), 't7');
  assert.equal(gameCard.tagColorKey('悬疑'), 't7');
  assert.equal(gameCard.tagColorKey('科幻'), 't6');
  assert.equal(gameCard.tagColorKey('校园'), 't8');

  for (const tag of ['解谜', '独立游戏', '文字游戏']) {
    const key = gameCard.tagColorKey(tag);
    assert.match(key, /^t(?:[0-9]|1[01])$/u, `${tag} 应落到 t0..t11`);
    assert.equal(gameCard.tagColorKey(tag), key, `${tag} 的配色必须稳定`);
  }
});

test('发行日期只解析严格且真实的 YYYY-MM-DD', () => {
  assert.equal(gameCard.formatReleaseMonth('2024-07-22'), '2024年07月');
  assert.equal(gameCard.formatReleaseMonth('2026-02-29'), null);
  assert.equal(gameCard.formatReleaseMonth('2024-7-22'), null);
  assert.equal(gameCard.formatReleaseMonth('2024-07'), null);
  assert.equal(gameCard.formatReleaseMonth(null), null);
  assert.equal(gameCard.gameCardPresentation({ 发行日期: '无效' }).releaseMonth, null);
});

test('个人评分 0 有效，空值与非法值不渲染', () => {
  assert.deepEqual(gameCard.ratingPresentation(0), { hasValue: true, label: '0' });
  assert.deepEqual(gameCard.ratingPresentation(6.5), { hasValue: true, label: '6.5' });
  assert.deepEqual(gameCard.ratingPresentation('7'), { hasValue: true, label: '7' });
  assert.deepEqual(gameCard.ratingPresentation(null), { hasValue: false, label: '' });
  assert.deepEqual(gameCard.ratingPresentation(''), { hasValue: false, label: '' });
  assert.deepEqual(gameCard.ratingPresentation('abc'), { hasValue: false, label: '' });
  assert.deepEqual(gameCard.ratingPresentation(-1), { hasValue: false, label: '' });
});

// --- 累计游玩时间 ---

test('游玩分钟按非负整数换算，空值与非法值不冒充 0', () => {
  assert.equal(gameCard.formatPlaytime(0), '0分钟');
  assert.equal(gameCard.formatPlaytime(30), '30分钟');
  assert.equal(gameCard.formatPlaytime(59), '59分钟');
  assert.equal(gameCard.formatPlaytime(60), '1小时');
  assert.equal(gameCard.formatPlaytime(61), '1小时1分');
  assert.equal(gameCard.formatPlaytime(150), '2小时30分');
  assert.equal(gameCard.formatPlaytime('150'), '2小时30分');

  for (const invalid of [null, undefined, '', '   ', 'abc', -5, 1.5, NaN, Infinity, {}, []]) {
    assert.equal(gameCard.formatPlaytime(invalid), null, `非法值 ${String(invalid)} 应为 null`);
  }
  assert.equal(gameCard.normalizeMinutes(0), 0);
  assert.equal(gameCard.normalizeMinutes('0'), 0);
});

test('信息行按平台与时长分别降级', () => {
  assert.equal(gameCard.gameInfoLine('学习版', 150), '学习版 · 已游玩 2小时30分');
  assert.equal(gameCard.gameInfoLine('学习版', null), '学习版');
  assert.equal(gameCard.gameInfoLine('', 150), '已游玩 2小时30分');
  assert.equal(gameCard.gameInfoLine('学习版', 'abc'), '学习版');
  assert.equal(gameCard.gameInfoLine('', null), null);
  assert.equal(gameCard.gameInfoLine(null, undefined), null);
  assert.equal(gameCard.gameInfoLine('  ', '  '), null);
});

test('展示模型不含任何完成度或百分比字段', () => {
  const presentation = gameCard.gameCardPresentation(SAMPLE);
  const serialized = JSON.stringify(presentation);

  assert.equal(/percent|percentage|completion|progress|进度|百分比/iu.test(serialized), false);
  assert.equal(Object.keys(presentation).some((key) => /progress|percent/iu.test(key)), false);
});

// --- DOM 渲染 ---

test('渲染出的卡片结构与真实样例文案一致', () => {
  const root = renderCard(SAMPLE);

  assert.deepEqual(classNames(root), ['aganGameCard--Root']);
  assert.deepEqual(
    root.children.map((child) => classNames(child)[0]),
    ['aganGameCard--CoverArea', 'aganGameCard--Body'],
  );

  const text = collectText(root);
  for (const expected of ['解谜', '已完成', '2024年07月', '★ 6.5', '接线疑云', '学习版 · 已游玩 2小时30分']) {
    assert.ok(text.includes(expected), `卡片文本缺少「${expected}」`);
  }
  for (const tag of ['解谜', '推理', '悬疑', '独立游戏', '文字游戏']) {
    assert.ok(text.includes(tag), `标签缺少「${tag}」`);
  }
  assert.equal(text.includes('未命名游戏'), false);

  const cover = find(root, 'aganGameCard--Cover');
  assert.equal(cover.src, SAMPLE.cover);
  assert.equal(cover.alt, '接线疑云封面');
  assert.equal(find(root, 'aganGameCard--Tags').children.length, 5);
});

test('缺失可选字段时隐藏对应行，且不伪造数据', () => {
  const root = renderCard({ 中文名: '空壳游戏' });
  const text = collectText(root);

  assert.equal(text.includes('未命名游戏'), false, '有标题时不应出现占位');
  assert.equal(find(root, 'aganGameCard--Tags'), null, '无有效标签时整行隐藏');
  assert.equal(find(root, 'aganGameCard--Info'), null, '平台与时长都缺失时整行隐藏');
  assert.equal(find(root, 'aganGameCard--Cover'), null, '无 cover 时不渲染 img');
  assert.equal(find(root, 'aganGameCard--CoverFrame').dataset.state, 'empty');
  assert.equal(text.includes('★'), false, '未收藏且无评分时不显示星号');
  assert.equal(/percent|进度|%/u.test(text.join(' ')), false);
});

test('只有平台或只有时长时信息行仍显示另一项', () => {
  const platformOnly = collectText(renderCard({ 中文名: 'A', 游玩平台: 'Steam' }));
  assert.ok(platformOnly.includes('Steam'));

  const minutesOnly = collectText(renderCard({ 中文名: 'A', 游玩分钟: 60 }));
  assert.ok(minutesOnly.includes('已游玩 1小时'));
});

test('收藏时标题前出现星号', () => {
  const favorite = renderCard({ 中文名: 'A', 收藏: true });
  assert.equal(find(favorite, 'aganGameCard--Title').textContent, '★ A');

  const plain = renderCard({ 中文名: 'A' });
  assert.equal(find(plain, 'aganGameCard--Title').textContent, 'A');
});

test('标签 chip 带 dataset.color，色板与动画侧同源', () => {
  const root = renderCard(SAMPLE);
  const tagRow = find(root, 'aganGameCard--Tags');
  const expected = SAMPLE.tags.slice(1).map((tag) => gameCard.tagColorKey(tag));

  assert.deepEqual(
    tagRow.children.map((chip) => chip.dataset.color),
    expected,
  );
  for (const color of expected) assert.match(color, /^t(?:[0-9]|1[01])$/u);
});

test('卡片根节点带 data-status，驱动四态状态色', () => {
  assert.equal(renderCard(SAMPLE).dataset.status, 'completed');
  assert.equal(renderCard({ 中文名: 'A', 状态: '▶️ 进行中' }).dataset.status, 'watching');
  assert.equal(renderCard({ 中文名: 'A', 状态: '⏳ 待定' }).dataset.status, 'planned');
  assert.equal(renderCard({ 中文名: 'A', 状态: '💭 未来也许' }).dataset.status, 'paused');
  assert.equal(renderCard({ 中文名: 'A' }).dataset.status, 'unknown');
});

// --- 静态契约 ---

test('插件注册 Field Type、Field Renderer 与游戏卡片墙 Database View', () => {
  const source = fs.readFileSync(path.join(BASE, '媒体库-游戏卡片.xdb.js'), 'utf8');

  assert.match(source, /ctx\.registerFieldType\(/u);
  assert.match(source, /ctx\.registerFieldRenderer\(/u);
  assert.match(source, /ctx\.registerDatabaseView\(/u);
  assert.equal(/ctx\.registerView\(/u.test(source), false, '画廊使用 Database View，不是自定义 View');
  assert.equal(plugin.id, 'agan-game-card');
  assert.throws(
    () =>
      plugin.install({
        registerFieldType: () => false,
        registerFieldRenderer() {},
        registerStyleSheet() {},
      }),
    /Failed to register agan:game-card/u,
  );
});

test('插件没有写回调用，也没有旧卡片墙的英文字段', () => {
  const source = fs.readFileSync(path.join(BASE, '媒体库-游戏卡片.xdb.js'), 'utf8');

  assert.equal(/updateCell|updateRow|setRowValue|deleteRow|createRow/u.test(source), false);
  assert.equal(/completion_percent|game_category|current_playthrough/u.test(source), false);
  assert.equal(/['"]status['"]|['"]rating['"]/u.test(source), false);
  assert.equal(/['"]original_name['"]/u.test(source), false);
});

test('registerStyleSheet 只允许 aganGameCard-- 与 aganGameGallery-- 两个前缀', () => {
  const source = fs.readFileSync(path.join(BASE, '媒体库-游戏卡片.xdb.js'), 'utf8');
  const prefixes = new Set(
    Array.from(source.matchAll(/\.([A-Za-z][\w-]*)--/gu), (match) => match[1]),
  );

  assert.deepEqual([...prefixes].sort(), ['aganGameCard', 'aganGameGallery']);
});

test('视觉契约与动画卡片对齐：宽度、比例、徽章、状态色、行高', () => {
  const source = fs.readFileSync(path.join(BASE, '媒体库-游戏卡片.xdb.js'), 'utf8');

  // 外壳与封面：与动画卡片同一套几何，但宽度改为随容器自适应
  assert.match(source, /width: min\(100%, 330px\)/u);
  assert.match(source, /aspect-ratio: 330 \/ 400/u);
  assert.match(source, /border-radius: 16px/u);
  assert.match(source, /linear-gradient\(transparent, rgb\(0 0 0 \/ 0\.42\)\)/u);

  // 四角徽章规格
  assert.match(source, /min-height: 1\.375rem/u);
  assert.match(source, /border-radius: 8px/u);

  // 四态状态标识色（对应动画的 暂缓/想看/在看/已看）
  for (const status of ['paused', 'planned', 'watching', 'completed']) {
    assert.ok(
      source.includes(`[data-status="${status}"] .aganGameCard--StatusBadge`),
      `缺少 ${status} 的状态色规则`,
    );
  }
  for (const marker of ['#6b7280', '#eab308', '#22c55e', '#3b82f6']) {
    assert.ok(source.includes(marker), `缺少状态标识色 ${marker}`);
  }

  // 12 组语义彩色标签，与动画侧同一套色板
  for (let index = 0; index < 12; index += 1) {
    assert.ok(source.includes(`[data-color="t${index}"]`), `缺少标签配色 t${index}`);
  }
  assert.match(source, /const TAG_COLOR_GROUPS = Object\.freeze\(\[/u);
  assert.match(source, /function tagColorKey\(tag\)/u);

  // 行高归一化：每行卡片底边对齐靠内容等高等高，不靠固定容器高度
  assert.match(source, /min-height: 2\.6em/u);
  assert.match(source, /height: calc\(2 \* \(1\.4em \+ 4px\) \+ 4px\)/u);

  // 不继承动画卡片的写操作与进度区
  assert.equal(/backdrop-filter/u.test(source), false, '毛玻璃是动画侧已废掉的方案');
  assert.equal(
    /aganGameCard--(?:Description|Progress|Percentage|StepControls)/u.test(source),
    false,
    '游戏卡片没有简介入口、进度条或集数操作',
  );
  assert.equal(/ctx\.registerView\(/u.test(source), false);
  assert.match(source, /ctx\.registerDatabaseView\(/u, '画廊必须走 Database View 注册');
});

// --- XDB 配置 ---

test('媒体库放行 Bangumi 数据源，并把游戏卡片字段挂到游戏画廊 view', () => {
  const definition = readLibraryContaining('agan:game-card');

  assert.equal(definition.source, 'file');
  // 用户把动画库与游戏库合并成一个 .xdb（媒体库单个视图.xdb）：
  // 全局 filter 只声明「范围＝310 媒体库 目录」，类型范围下沉到各 view 自己的 view 级 filter。
  // Task 09 按用户裁决 O1 把范围从「数据来源=Bangumi」放宽为目录范围（后续数据来源还会加豆瓣）。
  assert.equal(definition.filter.join, 'and');
  const expressions = definition.filter.items.map((item) => item.expression).join(' | ');
  assert.match(expressions, /310 媒体库/u);
  assert.equal(/数据来源/u.test(expressions), false, '范围不再按数据来源限定');

  const cardField = definition.fields.find((field) => field.name === '游戏卡片');
  assert.equal(cardField.type, 'agan:game-card');

  // 用户会自行增删同一个 .xdb 里的 view、或改 view 的 id 与名字（原有的 game-card-table 已被用户移除），
  // 所以只按扩展点 id 找 view，只断言「游戏卡片字段被游戏画廊 view 使用」。
  const gallery = definition.views.find((view) => view.type === 'agan:game-gallery');
  assert.ok(gallery, '游戏画廊 view 应存在');
  assert.deepEqual(gallery.visibleFields, ['游戏卡片']);
  const viewExpressions = (gallery.filter?.items ?? []).map((item) => item.expression).join(' | ');
  assert.match(viewExpressions, /作品大类/u);
  assert.match(viewExpressions, /游戏/u);
});

test('游戏画廊 view 只使用游戏卡片字段，不借用动画卡片', () => {
  const definition = readLibraryContaining('agan:game-card');
  const gallery = definition.views.find((view) => view.type === 'agan:game-gallery');

  assert.ok(gallery, '游戏画廊 view 应存在');
  assert.deepEqual(gallery.visibleFields, ['游戏卡片']);
  assert.equal(gallery.visibleFields.includes('动画卡片'), false, '游戏画廊不应渲染动画卡片');

  const cardField = definition.fields.find((field) => field.name === '游戏卡片');
  assert.equal(cardField.type, 'agan:game-card');
});

test('游戏插件不注册、也不引用任何动画扩展点', () => {
  // 合并成一个 .xdb 后，两个插件仍必须彼此独立：不能互相 require，也不能借用对方的扩展点 id。
  const source = fs.readFileSync(path.join(BASE, '媒体库-游戏卡片.xdb.js'), 'utf8');
  assert.deepEqual(source.match(/agan:anime-[a-z-]+/gu) ?? [], []);
  assert.equal(/require\(/u.test(source), false, 'xdb 插件之间不能互相 require');
});
