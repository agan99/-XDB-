// 总媒体库插件（Task 09 - 总媒体库画廊）
//
// 依据：Plans/Task 09 - Approved Plan.md
// 职责：
//   1. 注册 agan:media-card 字段类型与只读渲染器，展示单张「集合通用卡」；
//   2. 注册 agan:media-gallery Database View，做集合级类型/状态/收藏筛选、
//      搜索、排序与渐进加载；
//   3. 注册一份 aganMediaCard-- / aganMediaGallery-- 前缀的样式表。
//
// 本插件是 媒体库-动画卡片.xdb.js 与 媒体库-游戏卡片.xdb.js 之外的第三个独立插件。
// 三个 *.xdb.js 各自独立加载、无法互相 require，因此公共视觉基线各存一份同构副本；
// 但本插件**不复制**任何媒体的业务逻辑：没有进度、没有游玩时长、没有简介写回。

const PLUGIN_ID = 'agan-media-library';
const CARD_FIELD_TYPE = 'agan:media-card';
const CARD_RENDERER_ID = 'agan-media-library:card-renderer';
const GALLERY_VIEW_TYPE = 'agan:media-gallery';

const GALLERY_BATCH_SIZE = 24;
const TAG_LIMIT = 5;
const TAG_PALETTE_SIZE = 12;
const UNTITLED = '未命名';

// 通用卡的最小宽度与网格间距：初值沿用既有两套画廊（视觉一致），
// 属可调常量——《视觉效果管理规范》§6 把「改变公共卡片尺寸比例与画廊列数规则」
// 列为必须进 Task/Plan 的改动，因此这里的数值不是不可变契约。
const CARD_MIN_WIDTH = 210;
const GRID_GAP = 12;

const TITLE_KEYS = Object.freeze(['中文名', '原名', 'name']);
const DATE_FIELD = '完成日期';

// 类型显示名。键是内部的类型 key，值是角标上显示的词。
const TYPE_LABELS = Object.freeze({
  anime: '动画',
  game: '游戏',
  series: '剧集',
  movie: '电影',
  book: '书籍',
  comic: '漫画',
});

// 类型按钮顺序（Task 09 §2.1 / 《集合画廊设计规范》§2.2）：前面再补一个「全部」。
const TYPE_ORDER = Object.freeze(['anime', 'game', 'series', 'movie', 'book', 'comic']);

// 显式类型映射表（Task 09 §10.2 / Approved Plan §2.4）。
// 不用 contains() 之类的模糊匹配：真实数据里既有「动画」也有「Anime」，还有模板占位
// 「{{metadata.mediaType}}」；未列出的值一律视为「未归类」，不得被错误归入某个类型。
const TYPE_ALIASES = Object.freeze({
  动画: 'anime',
  anime: 'anime',
  Anime: 'anime',
  游戏: 'game',
  game: 'game',
  Game: 'game',
  剧集: 'series',
  series: 'series',
  Series: 'series',
  电影: 'movie',
  movie: 'movie',
  Movie: 'movie',
  书籍: 'book',
  book: 'book',
  Book: 'book',
  漫画: 'comic',
  comic: 'comic',
  Comic: 'comic',
});

// 状态正式值 → 内部 status key（《集合卡片设计规范》§4）。
// 真实数据里状态值可能带引号（"⏳ 待定"），由 normalizeStatus 先去引号再全等匹配。
const STATUS_KEYS = Object.freeze({
  '💭 未来也许': 'paused',
  '⏳ 待定': 'planned',
  '▶️ 进行中': 'watching',
  '✅ 已完成': 'completed',
});

// 状态按钮顺序固定为「待定、进行中、已完成、暂缓」（Task 09 §2.4）。
const STATUS_ORDER = Object.freeze(['planned', 'watching', 'completed', 'paused']);

// 状态用词分两套（Task 09 §2.4 +《集合卡片设计规范》§3/§4）：
//   - 筛选按钮恒用 neutral（中性词）；
//   - 卡片角标按媒体类型取词；动画与游戏已有正式 Requirement，四类新媒体未批准前回落中性词。
// 将来接入新类型只需在此加一行数据，不改任何逻辑。
const STATUS_LABELS = Object.freeze({
  neutral: Object.freeze({ planned: '待定', watching: '进行中', completed: '已完成', paused: '暂缓' }),
  anime: Object.freeze({ planned: '想看', watching: '在看', completed: '已看', paused: '暂缓' }),
  game: Object.freeze({ planned: '想玩', watching: '在玩', completed: '已玩', paused: '暂缓' }),
});

const STATUS_BUTTON_LABELS = STATUS_LABELS.neutral;

// 只有两个排序入口，顺序固定（Task 09 §2.6）。默认方向都是降序。
const SORTS = Object.freeze({
  personalRating: Object.freeze({ key: 'personalRating', label: '个人评分', defaultDirection: 'desc' }),
  completionDate: Object.freeze({ key: 'completionDate', label: '完成日期', defaultDirection: 'desc' }),
});

const SORT_ORDER = Object.freeze(['personalRating', 'completionDate']);

const EMPTY_COLLECTION_MESSAGE = '媒体库暂无记录';
const EMPTY_RESULT_MESSAGE = '没有符合当前条件的记录';

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function textValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

// 去掉笔记里可能存在的成对引号：真实数据同时存在 `"2021-10-07"` 与 `2021-09-05`。
function unquote(value) {
  const text = textValue(value);
  if (text === null || text.length < 2) return text;
  const first = text[0];
  const last = text[text.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return text.slice(1, -1).trim();
  }
  return text;
}

function normalizeType(value) {
  const text = unquote(value);
  if (text === null) return null;
  return TYPE_ALIASES[text] ?? null;
}

function normalizeStatus(value) {
  const text = unquote(value);
  if (text === null) return null;
  return STATUS_KEYS[text] ?? null;
}

function statusLabel(typeKey, statusKey) {
  const table = STATUS_LABELS[typeKey] ?? STATUS_LABELS.neutral;
  return table[statusKey] ?? STATUS_LABELS.neutral[statusKey] ?? STATUS_LABELS.neutral.planned;
}

// 有效完成日期：可解析成真实日历日的 YYYY-MM-DD（去引号后判断）。
// 无定义或无值时不显示、也不参与数值排序（Task 09 §2.6 / 集合卡片规范 §3）。
function normalizeDate(value) {
  const text = unquote(value);
  const match = text?.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

// 有效评分：有限数字。**0 是有效值**（不能因为假值判断被当成空值）。
function normalizeRating(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(number) ? number : null;
}

function resolveTitle(item) {
  const source = item ?? {};
  for (const key of TITLE_KEYS) {
    const value = textValue(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function itemTitle(item) {
  return resolveTitle(item) ?? UNTITLED;
}

function isFavorite(value) {
  return value === true;
}

function firstTags(tags) {
  if (!Array.isArray(tags)) return [];

  const result = [];
  for (const tag of tags) {
    const value = textValue(tag);
    if (value === null) continue;
    result.push(value);
    if (result.length >= TAG_LIMIT) break;
  }
  return result;
}

// 标签配色：与 媒体库-动画卡片.xdb.js / 媒体库-游戏卡片.xdb.js 的 TAG_COLOR_GROUPS
// 逐组、逐关键词相同（公共视觉基线）。
const TAG_COLOR_GROUPS = Object.freeze([
  { color: 't0', keywords: ['后宫', '卖肉', '肉', '福利', '情色', '成人'] },
  { color: 't1', keywords: ['恋爱', '爱情', '浪漫', '百合', '耽美', '乙女'] },
  { color: 't2', keywords: ['搞笑', '喜剧', '吐槽', '沙雕', '恶搞'] },
  { color: 't3', keywords: ['日常', '治愈', '温馨', '亲情', '萌', '萌系'] },
  { color: 't4', keywords: ['战斗', '热血', '格斗', '战争', '军事'] },
  { color: 't5', keywords: ['奇幻', '异世界', '魔法', '转生', '冒险'] },
  { color: 't6', keywords: ['科幻', '机战', '末日', '赛博', '硬科幻'] },
  { color: 't7', keywords: ['悬疑', '推理', '惊悚', '恐怖', '猎奇', '犯罪'] },
  { color: 't8', keywords: ['校园', '青春', '学生', '社团'] },
  { color: 't9', keywords: ['音乐', '偶像', '乐队', '歌舞'] },
  { color: 't10', keywords: ['运动', '体育', '竞技', '赛车'] },
  { color: 't11', keywords: ['历史', '传记', '时代剧', '政治', '职场'] },
]);

function tagColorKey(tag) {
  const text = String(tag);
  for (const group of TAG_COLOR_GROUPS) {
    for (const keyword of group.keywords) {
      if (text.includes(keyword)) return group.color;
    }
  }
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.codePointAt(0)) % 1000003;
  return `t${hash % TAG_PALETTE_SIZE}`;
}

function mediaCardPresentation(item) {
  const source = item ?? {};
  const title = resolveTitle(source);
  const typeKey = normalizeType(source['作品大类']);
  const statusKey = normalizeStatus(source['状态']);
  const rating = normalizeRating(source['个人评分']);
  const dateValue = normalizeDate(source[DATE_FIELD]);

  return {
    typeKey,
    typeLabel: typeKey === null ? null : TYPE_LABELS[typeKey],
    statusKey,
    statusLabel: statusKey === null ? null : statusLabel(typeKey, statusKey),
    cover: textValue(source.cover),
    title: title ?? UNTITLED,
    hasTitle: title !== null,
    favorite: isFavorite(source['收藏']),
    rating,
    dateValue,
    dateLabel: dateValue === null ? null : dateValueToLabel(dateValue),
    tags: firstTags(source.tags),
  };
}

function dateValueToLabel(value) {
  if (value === null) return null;
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}年${month}月`;
}

// --- 收藏行与筛选/排序纯函数（全部同步、无副作用，供测试直接调用） ---

function collectRows(groups) {
  const rows = [];
  const seen = new Set();

  function visit(currentGroups) {
    if (!Array.isArray(currentGroups)) return;
    for (const group of currentGroups) {
      for (const row of Array.isArray(group?.rows) ? group.rows : []) {
        if (!row || typeof row.id !== 'string' || seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push(row);
      }
      visit(group?.groups);
    }
  }

  visit(groups);
  return rows;
}

function createState() {
  return {
    types: [],              // 空数组 = 全部六类
    status: null,           // null = 全部
    favoriteOnly: false,
    query: '',
    sort: null,             // null = 默认排序
    visibleCount: GALLERY_BATCH_SIZE,
  };
}

function toggleType(state, typeKey) {
  const current = Array.isArray(state.types) ? state.types : [];
  const next = current.includes(typeKey)
    ? current.filter((key) => key !== typeKey)
    : [...current, typeKey];
  return { ...state, types: next };
}

function toggleFavorite(state) {
  return { ...state, favoriteOnly: !state.favoriteOnly };
}

function toggleStatus(state, statusKey) {
  return { ...state, status: state.status === statusKey ? null : statusKey };
}

function setStatusAll(state) {
  return { ...state, status: null };
}

function cycleSort(currentSort, key) {
  const definition = SORTS[key];
  if (!definition) return currentSort;
  if (!currentSort || currentSort.key !== key) {
    return { key, direction: definition.defaultDirection };
  }
  if (currentSort.direction === definition.defaultDirection) {
    return { key, direction: definition.defaultDirection === 'asc' ? 'desc' : 'asc' };
  }
  return null;
}

function clearConditions(state) {
  return {
    ...state,
    types: [],
    status: null,
    favoriteOnly: false,
    query: '',
  };
}

function searchTerms(query) {
  const normalized = typeof query === 'string' ? query.trim().toLocaleLowerCase() : '';
  return normalized === '' ? [] : normalized.split(/\s+/u);
}

// 搜索字段范围只有 中文名 / 原名 / tags（Task 09 §2.5）：不搜 name、不搜 description。
function searchValues(item) {
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  return [item?.['中文名'], item?.['原名'], ...tags]
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLocaleLowerCase());
}

function filterRows(rows, state) {
  const selectedTypes = Array.isArray(state.types) ? state.types : [];
  const terms = searchTerms(state.query);

  return rows.filter((row) => {
    const item = row?.$item ?? {};

    if (selectedTypes.length > 0) {
      const typeKey = normalizeType(item['作品大类']);
      if (typeKey === null || !selectedTypes.includes(typeKey)) return false;
    }

    if (state.status !== null && normalizeStatus(item['状态']) !== state.status) return false;
    if (state.favoriteOnly && item['收藏'] !== true) return false;

    if (terms.length === 0) return true;
    const values = searchValues(item);
    return terms.every((term) => values.some((value) => value.includes(term)));
  });
}

function compareTitles(left, right) {
  const leftTitle = resolveTitle(left?.$item) ?? '';
  const rightTitle = resolveTitle(right?.$item) ?? '';
  return leftTitle.localeCompare(rightTitle, 'zh-CN', { sensitivity: 'base', numeric: true });
}

// 空值排序规则（Task 09 §2.6）：无效值一律排最后，**不随升降方向翻转**。
function compareNullableValues(left, right, direction, compareValues) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const result = compareValues(left, right);
  return direction === 'asc' ? result : -result;
}

// 默认排序（未点任何排序按钮）四级稳定键：
//   1. 完成日期降序，无效值排最后
//   2. 个人评分降序，无效值排最后
//   3. 标题升序
//   4. row.id 升序
function compareRowsByDefault(left, right) {
  let result = compareNullableValues(
    normalizeDate(left?.$item?.[DATE_FIELD]),
    normalizeDate(right?.$item?.[DATE_FIELD]),
    'desc',
    (a, b) => a - b,
  );
  if (result !== 0) return result;

  result = compareNullableValues(
    normalizeRating(left?.$item?.['个人评分']),
    normalizeRating(right?.$item?.['个人评分']),
    'desc',
    (a, b) => a - b,
  );
  if (result !== 0) return result;

  result = compareTitles(left, right);
  if (result !== 0) return result;

  const leftId = typeof left?.id === 'string' ? left.id : '';
  const rightId = typeof right?.id === 'string' ? right.id : '';
  return leftId.localeCompare(rightId);
}

// 主动排序：只有 个人评分 / 完成日期 两个键；键值相等时回落到标题与 row.id。
function sortRows(rows, sort) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    if (sort === null) return compareRowsByDefault(left, right);

    const definition = SORTS[sort.key];
    if (!definition) return compareRowsByDefault(left, right);

    const valueOf = sort.key === 'completionDate' ? normalizeDate : normalizeRating;
    const field = sort.key === 'completionDate' ? DATE_FIELD : '个人评分';
    let result = compareNullableValues(
      valueOf(left?.$item?.[field]),
      valueOf(right?.$item?.[field]),
      sort.direction,
      (a, b) => a - b,
    );
    if (result === 0) result = compareTitles(left, right);

    if (result === 0) {
      const leftId = typeof left?.id === 'string' ? left.id : '';
      const rightId = typeof right?.id === 'string' ? right.id : '';
      result = leftId.localeCompare(rightId);
    }
    return result;
  });
  return sorted;
}

// 计数恒基于传入的全量行（完整结果集合），不随分页改变。
function countRows(rows) {
  const counts = {
    all: rows.length,
    favorite: 0,
    anime: 0,
    game: 0,
    series: 0,
    movie: 0,
    book: 0,
    comic: 0,
    unclassified: 0,
    planned: 0,
    watching: 0,
    completed: 0,
    paused: 0,
  };

  for (const row of rows) {
    const item = row?.$item ?? {};

    const typeKey = normalizeType(item['作品大类']);
    if (typeKey === null) counts.unclassified += 1;
    else counts[typeKey] += 1;

    const statusKey = normalizeStatus(item['状态']);
    if (statusKey !== null) counts[statusKey] += 1;

    if (item['收藏'] === true) counts.favorite += 1;
  }
  return counts;
}

function resolve(rows, state) {
  const filtered = filterRows(rows, state);
  const sorted = sortRows(filtered, state.sort);
  const visibleCount = Math.max(0, Number(state.visibleCount) || 0);
  return {
    counts: countRows(rows),
    allResults: sorted,
    visibleRows: sorted.slice(0, visibleCount),
    isEmptyCollection: rows.length === 0,
    isEmptyResult: rows.length > 0 && sorted.length === 0,
  };
}

function nextVisibleCount(current, total) {
  return Math.min(total, Math.max(GALLERY_BATCH_SIZE, current) + GALLERY_BATCH_SIZE);
}

const mediaGallery = Object.freeze({
  batchSize: GALLERY_BATCH_SIZE,
  typeKeys: TYPE_LABELS,
  typeOrder: TYPE_ORDER,
  statuses: STATUS_KEYS,
  statusButtonOrder: STATUS_ORDER,
  statusButtonLabels: STATUS_BUTTON_LABELS,
  statusLabels: STATUS_LABELS,
  statusLabel,
  sorts: SORTS,
  sortOrder: SORT_ORDER,
  emptyCollectionMessage: EMPTY_COLLECTION_MESSAGE,
  emptyResultMessage: EMPTY_RESULT_MESSAGE,
  collectRows,
  createState,
  toggleType,
  toggleFavorite,
  toggleStatus,
  setStatusAll,
  cycleSort,
  clearConditions,
  normalizeType,
  normalizeStatus,
  normalizeDate,
  normalizeRating,
  itemTitle,
  filterRows,
  sortRows,
  countRows,
  resolve,
  nextVisibleCount,
});

// --- 集合通用卡：只读，不含任何媒体的专属业务元素 ---

function renderCardCover(presentation) {
  const area = element('section', 'aganMediaCard--CoverArea');

  const frame = element('div', 'aganMediaCard--CoverFrame');
  const placeholder = element('div', 'aganMediaCard--CoverPlaceholder', '暂无封面');
  frame.appendChild(placeholder);

  if (presentation.cover === null) {
    frame.dataset.state = 'empty';
  } else {
    const image = element('img', 'aganMediaCard--Cover');
    image.alt = `${presentation.title}封面`;
    image.loading = 'lazy';
    image.addEventListener('load', () => {
      frame.dataset.state = 'ready';
    });
    image.addEventListener('error', () => {
      image.remove();
      frame.dataset.state = 'error';
      placeholder.textContent = '封面加载失败';
    });
    image.src = presentation.cover;
    frame.appendChild(image);
  }
  area.appendChild(frame);

  const coverTop = element('div', 'aganMediaCard--CoverTop');
  if (presentation.typeLabel !== null) {
    coverTop.appendChild(
      element('span', 'aganMediaCard--Badge aganMediaCard--TypeBadge', presentation.typeLabel),
    );
  }
  if (presentation.statusLabel !== null) {
    coverTop.appendChild(
      element('span', 'aganMediaCard--Badge aganMediaCard--StatusBadge', presentation.statusLabel),
    );
  }
  area.appendChild(coverTop);

  const coverBottom = element('div', 'aganMediaCard--CoverBottom');
  if (presentation.dateLabel !== null) {
    coverBottom.appendChild(
      element('span', 'aganMediaCard--MetaBadge aganMediaCard--DateBadge', presentation.dateLabel),
    );
  }
  if (presentation.rating !== null) {
    coverBottom.appendChild(
      element('span', 'aganMediaCard--MetaBadge aganMediaCard--RatingBadge', `★ ${presentation.rating}`),
    );
  }
  area.appendChild(coverBottom);

  return area;
}

function renderCardBody(presentation) {
  const body = element('section', 'aganMediaCard--Body');

  const title = element(
    'div',
    'aganMediaCard--Title',
    `${presentation.favorite ? '★ ' : ''}${presentation.title}`,
  );
  title.dataset.empty = String(!presentation.hasTitle);
  body.appendChild(title);

  if (presentation.tags.length > 0) {
    const tagRow = element('div', 'aganMediaCard--Tags');
    for (const tag of presentation.tags) {
      const chip = element('span', 'aganMediaCard--Tag', tag);
      chip.dataset.color = tagColorKey(tag);
      tagRow.appendChild(chip);
    }
    body.appendChild(tagRow);
  }

  return body;
}

function createMediaCardInstance() {
  return {
    onUpdate(props) {
      const presentation = mediaCardPresentation(props.row?.$item);

      const root = element('article', 'aganMediaCard--Root');
      if (presentation.typeKey !== null) root.dataset.type = presentation.typeKey;
      if (presentation.statusKey !== null) root.dataset.status = presentation.statusKey;
      root.appendChild(renderCardCover(presentation));
      root.appendChild(renderCardBody(presentation));

      props.container.replaceChildren(root);
    },

    onDestroy() {},
  };
}

const mediaCard = Object.freeze({
  mediaCardPresentation,
  resolveTitle,
  itemTitle,
  isFavorite,
  firstTags,
  tagColorKey,
  normalizeType,
  normalizeStatus,
  normalizeDate,
  normalizeRating,
  statusLabel,
});

// --- 总媒体库画廊实例 ---

function createMediaGalleryInstance() {
  let destroyed = false;
  let generation = 0;
  let latestProps = null;
  let state = mediaGallery.createState();
  let root = null;
  let grid = null;
  let resultsArea = null;
  let emptyState = null;
  let searchInput = null;
  let loadMoreButton = null;
  let loadMoreSentinel = null;
  let intersectionObserver = null;
  let currentResults = [];
  const cards = new Map();
  const typeButtons = new Map();
  const statusButtons = new Map();
  let favoriteButton = null;
  const sortButtons = new Map();

  function isCurrent(token) {
    return !destroyed && token === generation;
  }

  function destroyCard(rowId) {
    const card = cards.get(rowId);
    if (!card) return;
    card.instance.onDestroy();
    card.slot.remove();
    cards.delete(rowId);
  }

  function destroyAllCards() {
    for (const rowId of Array.from(cards.keys())) destroyCard(rowId);
  }

  function resetAndRender(nextState) {
    state = { ...nextState, visibleCount: GALLERY_BATCH_SIZE };
    render();
  }

  function createToggleButton(label, className, onClick) {
    const button = element('button', className, label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function ensureDom(props) {
    if (root !== null) return;

    root = element('section', 'aganMediaGallery--Root');
    const heading = element('h2', 'aganMediaGallery--Heading', '总媒体库');
    const navigation = element('nav', 'aganMediaGallery--Navigation');
    navigation.setAttribute('aria-label', '总媒体库导航');

    const topRow = element('div', 'aganMediaGallery--Row aganMediaGallery--RowTop');
    favoriteButton = createToggleButton('★收藏', 'aganMediaGallery--Toggle', () => {
      resetAndRender(mediaGallery.toggleFavorite(state));
    });
    const searchWrapper = element('div', 'aganMediaGallery--SearchWrapper');
    searchInput = element('input', 'aganMediaGallery--Search');
    searchInput.type = 'search';
    searchInput.placeholder = '搜索中文名、原名或标签';
    searchInput.setAttribute('aria-label', '搜索总媒体库');
    searchInput.addEventListener('input', () => {
      resetAndRender({ ...state, query: searchInput.value });
    });
    searchWrapper.appendChild(searchInput);
    topRow.append(favoriteButton, searchWrapper);

    const typeRow = element('div', 'aganMediaGallery--Row aganMediaGallery--RowType');
    typeRow.setAttribute('role', 'group');
    typeRow.setAttribute('aria-label', '作品大类');
    const typeAll = createToggleButton('全部', 'aganMediaGallery--FilterButton', () => {
      resetAndRender({ ...state, types: [] });
    });
    typeButtons.set('all', { button: typeAll, label: '全部' });
    typeRow.appendChild(typeAll);
    for (const typeKey of TYPE_ORDER) {
      const label = TYPE_LABELS[typeKey];
      const button = createToggleButton(label, 'aganMediaGallery--FilterButton', () => {
        resetAndRender(mediaGallery.toggleType(state, typeKey));
      });
      typeButtons.set(typeKey, { button, label });
      typeRow.appendChild(button);
    }

    const statusRow = element('div', 'aganMediaGallery--Row aganMediaGallery--RowStatus');
    statusRow.setAttribute('role', 'group');
    statusRow.setAttribute('aria-label', '状态');
    const statusAll = createToggleButton('全部', 'aganMediaGallery--FilterButton', () => {
      resetAndRender(mediaGallery.setStatusAll(state));
    });
    statusButtons.set('all', { button: statusAll, label: '全部' });
    statusRow.appendChild(statusAll);
    for (const statusKey of STATUS_ORDER) {
      const label = STATUS_BUTTON_LABELS[statusKey];
      const button = createToggleButton(label, 'aganMediaGallery--FilterButton', () => {
        resetAndRender(mediaGallery.toggleStatus(state, statusKey));
      });
      statusButtons.set(statusKey, { button, label });
      statusRow.appendChild(button);
    }

    const sortRow = element('div', 'aganMediaGallery--Row aganMediaGallery--RowSort');
    sortRow.setAttribute('role', 'group');
    sortRow.setAttribute('aria-label', '排序');
    for (const sortKey of SORT_ORDER) {
      const definition = SORTS[sortKey];
      const button = createToggleButton(definition.label, 'aganMediaGallery--SortButton', () => {
        resetAndRender({ ...state, sort: mediaGallery.cycleSort(state.sort, sortKey) });
      });
      sortButtons.set(sortKey, { button, label: definition.label });
      sortRow.appendChild(button);
    }

    navigation.append(topRow, typeRow, statusRow, sortRow);

    resultsArea = element('div', 'aganMediaGallery--Results');
    grid = element('div', 'aganMediaGallery--Grid');
    emptyState = element('div', 'aganMediaGallery--Empty');
    emptyState.hidden = true;
    loadMoreButton = element('button', 'aganMediaGallery--LoadMore', '加载更多');
    loadMoreButton.type = 'button';
    loadMoreButton.hidden = true;
    loadMoreButton.addEventListener('click', () => {
      loadNextPage();
    });
    loadMoreSentinel = element('div', 'aganMediaGallery--Sentinel');
    loadMoreSentinel.setAttribute('aria-hidden', 'true');
    resultsArea.append(grid, emptyState, loadMoreSentinel, loadMoreButton);
    root.append(heading, navigation, resultsArea);
    props.container.replaceChildren(root);

    if (typeof IntersectionObserver === 'function') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (destroyed || !entries.some((entry) => entry.isIntersecting)) return;
          loadNextPage();
        },
        { rootMargin: '600px 0px' },
      );
    }
  }

  function loadNextPage() {
    const nextCount = mediaGallery.nextVisibleCount(state.visibleCount, currentResults.length);
    if (nextCount === state.visibleCount) return;
    state = { ...state, visibleCount: nextCount };
    render();
  }

  function updateControls() {
    for (const [key, entry] of typeButtons) {
      const active = key === 'all' ? state.types.length === 0 : state.types.includes(key);
      entry.button.setAttribute('aria-pressed', String(active));
      entry.button.dataset.active = String(active);
    }
    for (const [key, entry] of statusButtons) {
      const active = key === 'all' ? state.status === null : state.status === key;
      entry.button.setAttribute('aria-pressed', String(active));
      entry.button.dataset.active = String(active);
    }
    if (favoriteButton !== null) favoriteButton.setAttribute('aria-pressed', String(state.favoriteOnly));
    for (const [key, entry] of sortButtons) {
      const active = state.sort?.key === key;
      const arrow = active ? (state.sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
      entry.button.textContent = `${entry.label}${arrow}`;
      entry.button.setAttribute('aria-pressed', String(active));
      entry.button.dataset.active = String(active);
    }
    if (searchInput !== null && searchInput.value !== state.query) searchInput.value = state.query;
  }

  function getOrCreateCard(rowId) {
    let card = cards.get(rowId);
    if (card) return card;
    const slot = element('div', 'aganMediaGallery--CardSlot');
    const canvas = element('div', 'aganMediaGallery--CardCanvas');
    slot.appendChild(canvas);
    card = { slot, canvas, instance: createMediaCardInstance() };
    cards.set(rowId, card);
    return card;
  }

  function renderCardRows(rows) {
    const visibleIds = new Set(rows.map((row) => row.id));
    for (const rowId of Array.from(cards.keys())) {
      if (!visibleIds.has(rowId)) destroyCard(rowId);
    }

    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const card = getOrCreateCard(row.id);
      card.instance.onUpdate({ ...latestProps, container: card.canvas, row });
      fragment.appendChild(card.slot);
    }
    grid.replaceChildren(fragment);
  }

  function renderEmpty(kind) {
    if (kind === 'collection') {
      emptyState.replaceChildren(
        element('strong', 'aganMediaGallery--EmptyTitle', EMPTY_COLLECTION_MESSAGE),
        element('span', '', '当前媒体库目录没有可展示记录'),
      );
      return;
    }
    const clear = element('button', 'aganMediaGallery--ClearButton', '清除筛选');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      resetAndRender(mediaGallery.clearConditions(state));
    });
    emptyState.replaceChildren(
      element('strong', 'aganMediaGallery--EmptyTitle', EMPTY_RESULT_MESSAGE),
      element('span', '', '调整搜索或筛选条件试试'),
      clear,
    );
  }

  function render() {
    if (destroyed || !latestProps) return;
    ensureDom(latestProps);
    const rows = mediaGallery.collectRows(latestProps.viewData?.groups);
    const resolved = mediaGallery.resolve(rows, state);
    currentResults = resolved.allResults;
    updateControls();

    if (resolved.isEmptyCollection || resolved.isEmptyResult) {
      destroyAllCards();
      if (intersectionObserver !== null) intersectionObserver.disconnect();
      grid.replaceChildren();
      renderEmpty(resolved.isEmptyCollection ? 'collection' : 'result');
      emptyState.hidden = false;
      loadMoreButton.hidden = true;
      return;
    }

    emptyState.hidden = true;
    emptyState.replaceChildren();
    renderCardRows(resolved.visibleRows);
    const hasMore = resolved.visibleRows.length < resolved.allResults.length;
    if (intersectionObserver !== null && loadMoreSentinel !== null) {
      loadMoreButton.hidden = true;
      intersectionObserver.disconnect();
      if (hasMore) intersectionObserver.observe(loadMoreSentinel);
    } else {
      loadMoreButton.hidden = !hasMore;
    }
  }

  return {
    onUpdate(props) {
      latestProps = props;
      generation += 1;
      ensureDom(props);
      render();
    },

    onDestroy() {
      destroyed = true;
      generation += 1;
      destroyAllCards();
      if (intersectionObserver !== null) intersectionObserver.disconnect();
      intersectionObserver = null;
      cards.clear();
      root = null;
      grid = null;
      resultsArea = null;
      emptyState = null;
      searchInput = null;
      loadMoreButton = null;
      loadMoreSentinel = null;
      latestProps = null;
    },
  };
}

const GALLERY_STYLE = `
  .aganMediaCard--Root {
    box-sizing: border-box;
    display: grid;
    grid-template-rows: auto auto;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--background-modifier-border);
    border-radius: 16px;
    background: var(--background-primary-alt);
    color: var(--text-normal);
    white-space: normal;
    box-shadow: var(--shadow-s);
  }

  .aganMediaCard--CoverArea {
    position: relative;
    width: 100%;
    aspect-ratio: 330 / 400;
    overflow: hidden;
    background: var(--background-secondary);
  }

  .aganMediaCard--CoverArea::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 42%;
    pointer-events: none;
    background: linear-gradient(transparent, rgb(0 0 0 / 0.42));
  }

  .aganMediaCard--CoverFrame {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .aganMediaCard--Cover {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .aganMediaCard--CoverPlaceholder {
    padding: 0 var(--size-4-3);
    color: var(--text-faint);
    font-size: var(--font-ui-smaller);
    text-align: center;
  }

  .aganMediaCard--CoverFrame[data-state="ready"] .aganMediaCard--CoverPlaceholder {
    display: none;
  }

  .aganMediaCard--CoverFrame[data-state="error"] .aganMediaCard--CoverPlaceholder {
    color: var(--text-muted);
  }

  .aganMediaCard--CoverTop,
  .aganMediaCard--CoverBottom {
    position: absolute;
    right: var(--size-4-3);
    left: var(--size-4-3);
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-2-2);
    pointer-events: none;
  }

  .aganMediaCard--CoverTop {
    top: var(--size-4-3);
  }

  .aganMediaCard--CoverBottom {
    bottom: var(--size-4-3);
  }

  .aganMediaCard--Badge,
  .aganMediaCard--MetaBadge {
    flex: 0 0 auto;
    box-sizing: border-box;
    min-height: 1.375rem;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    border: 1px solid rgb(0 0 0 / 0.1);
    padding: 2px 8px;
    border-radius: 8px;
    overflow: hidden;
    color: #1f1c19;
    background: rgb(255 255 255 / 0.96);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.22);
    font-size: 11px;
    line-height: 1.35;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: auto;
  }

  .aganMediaCard--Root[data-status="paused"] .aganMediaCard--StatusBadge {
    color: #374151;
    background: #e5e7eb;
    border-color: #6b7280;
  }

  .aganMediaCard--Root[data-status="planned"] .aganMediaCard--StatusBadge {
    color: #713f12;
    background: #fef9c3;
    border-color: #eab308;
  }

  .aganMediaCard--Root[data-status="watching"] .aganMediaCard--StatusBadge {
    color: #14532d;
    background: #dcfce7;
    border-color: #22c55e;
  }

  .aganMediaCard--Root[data-status="completed"] .aganMediaCard--StatusBadge {
    color: #1e3a8a;
    background: #dbeafe;
    border-color: #3b82f6;
  }

  .aganMediaCard--Body {
    display: flex;
    flex-direction: column;
    gap: var(--size-2-3);
    min-width: 0;
    min-height: 0;
    padding: var(--size-4-3);
    overflow: hidden;
  }

  .aganMediaCard--Title {
    display: -webkit-box;
    min-width: 0;
    overflow-wrap: anywhere;
    min-height: 2.6em;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    color: var(--text-normal);
    font-size: 17px;
    font-weight: var(--font-semibold);
    line-height: 1.3;
  }

  .aganMediaCard--Title[data-empty="true"] {
    color: var(--text-faint);
    font-weight: 500;
  }

  .aganMediaCard--Tags {
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    gap: 4px;
    min-width: 0;
    height: calc(2 * (1.4em + 4px) + 4px);
    overflow: hidden;
    font-size: 11px;
    line-height: 1.4;
  }

  .aganMediaCard--Tag {
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    max-width: 100%;
    padding: 1px 7px;
    border: 1px solid transparent;
    border-radius: 5px;
    overflow: hidden;
    font-size: var(--font-ui-smaller);
    line-height: 1.6;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .aganMediaCard--Tag[data-color="t0"] { background: #fde2e4; color: #9d2449; }
  .aganMediaCard--Tag[data-color="t1"] { background: #ffe4e6; color: #9f1239; }
  .aganMediaCard--Tag[data-color="t2"] { background: #ffedd5; color: #9a3412; }
  .aganMediaCard--Tag[data-color="t3"] { background: #d1fae5; color: #065f46; }
  .aganMediaCard--Tag[data-color="t4"] { background: #fee2e2; color: #991b1b; }
  .aganMediaCard--Tag[data-color="t5"] { background: #ede9fe; color: #5b21b6; }
  .aganMediaCard--Tag[data-color="t6"] { background: #cffafe; color: #155e75; }
  .aganMediaCard--Tag[data-color="t7"] { background: #f3e8ff; color: #6b21a8; }
  .aganMediaCard--Tag[data-color="t8"] { background: #dbeafe; color: #1e40af; }
  .aganMediaCard--Tag[data-color="t9"] { background: #fce7f3; color: #9d174d; }
  .aganMediaCard--Tag[data-color="t10"] { background: #dcfce7; color: #166534; }
  .aganMediaCard--Tag[data-color="t11"] { background: #fef3c7; color: #92400e; }

  .aganMediaGallery--Root {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    overflow-x: clip;
    padding: 18px clamp(12px, 2%, 28px) 32px;
    color: var(--text-normal);
  }

  .aganMediaGallery--Navigation {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
    margin-bottom: 12px;
  }

  .aganMediaGallery--Heading {
    margin: 0 0 12px;
    padding: 12px 16px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--background-secondary) 82%, transparent);
    color: var(--text-normal);
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
  }

  .aganMediaGallery--Row {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--size-2-2);
    min-width: 0;
  }

  .aganMediaGallery--SearchWrapper {
    flex: 1 1 12rem;
    min-width: 0;
  }

  .aganMediaGallery--Search {
    width: 100%;
    min-width: 0;
    max-width: 22rem;
  }

  .aganMediaGallery--Toggle,
  .aganMediaGallery--FilterButton,
  .aganMediaGallery--SortButton,
  .aganMediaGallery--ClearButton,
  .aganMediaGallery--LoadMore {
    margin-right: 4px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    background: transparent;
    color: var(--text-muted);
    font-size: 15px;
  }

  .aganMediaGallery--Toggle[aria-pressed="true"],
  .aganMediaGallery--FilterButton[aria-pressed="true"],
  .aganMediaGallery--SortButton[aria-pressed="true"] {
    border-color: transparent;
    color: var(--text-on-accent);
    background: var(--interactive-accent);
  }

  .aganMediaGallery--FilterButton:focus-visible,
  .aganMediaGallery--SortButton:focus-visible,
  .aganMediaGallery--Toggle:focus-visible,
  .aganMediaGallery--ClearButton:focus-visible,
  .aganMediaGallery--LoadMore:focus-visible {
    outline: 2px solid var(--interactive-accent);
    outline-offset: 2px;
  }

  .aganMediaGallery--Results {
    width: 100%;
    min-width: 0;
    overflow-x: clip;
  }

  .aganMediaGallery--Grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(${CARD_MIN_WIDTH}px, 100%), 1fr));
    justify-content: start;
    align-items: start;
    gap: ${GRID_GAP}px;
    width: 100%;
  }

  .aganMediaGallery--CardSlot {
    position: relative;
    width: 100%;
    min-width: 0;
    height: auto;
    overflow: hidden;
    transition: transform 160ms ease;
  }

  @media (hover: hover) {
    .aganMediaGallery--CardSlot:hover {
      z-index: 1;
      transform: translateY(-2px);
    }
  }

  .aganMediaGallery--CardSlot:focus-within {
    z-index: 1;
    transform: translateY(-2px);
  }

  @media (prefers-reduced-motion: reduce) {
    .aganMediaGallery--CardSlot {
      transition: none;
    }

    .aganMediaGallery--CardSlot:hover,
    .aganMediaGallery--CardSlot:focus-within {
      transform: none;
    }
  }

  .aganMediaGallery--CardCanvas {
    width: 100%;
    min-width: 0;
    height: auto;
  }

  .aganMediaGallery--Empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-2-3);
    padding: var(--size-4-6) 0;
    color: var(--text-muted);
  }

  .aganMediaGallery--Empty[hidden] {
    display: none;
  }

  .aganMediaGallery--EmptyTitle {
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
  }

  .aganMediaGallery--LoadMore {
    margin-top: 16px;
    padding: 6px 16px;
  }

  .aganMediaGallery--LoadMore[hidden] {
    display: none;
  }

  @media (max-width: 540px) {
    .aganMediaGallery--RowTop {
      align-items: stretch;
    }

    .aganMediaGallery--SearchWrapper {
      flex-basis: 100%;
    }
  }

  /* 与动画卡片保持同一套封面角标语言：类型深色、状态按语义着色、
     日期与评分使用白色胶囊。这里仅覆盖总媒体库的视觉层。 */
  .aganMediaCard--Badge,
  .aganMediaCard--MetaBadge {
    min-height: 1.75rem;
    padding: 3px 10px;
    border-radius: 999px;
    border-color: rgb(255 255 255 / 0.18);
    box-shadow: 0 2px 5px rgb(22 18 28 / 0.2);
    font-size: 12px;
    font-weight: 600;
  }

  .aganMediaCard--TypeBadge,
  .aganMediaCard--DateBadge,
  .aganMediaCard--RatingBadge {
    color: #fff;
    background: rgb(42 36 50 / 0.78);
  }

  .aganMediaCard--RatingBadge {
    min-width: 3.25rem;
    justify-content: center;
    border-color: rgb(250 214 127 / 0.3);
    background: rgb(51 42 40 / 0.86);
    color: #f9dc80;
  }

  .aganMediaCard--Root[data-status="paused"] .aganMediaCard--StatusBadge {
    color: #374151;
    background: #e5e7eb;
    border-color: #6b7280;
  }

  .aganMediaCard--Root[data-status="planned"] .aganMediaCard--StatusBadge {
    color: #713f12;
    background: #fef9c3;
    border-color: #eab308;
  }

  .aganMediaCard--Root[data-status="watching"] .aganMediaCard--StatusBadge {
    color: #14532d;
    background: #dcfce7;
    border-color: #22c55e;
  }

  .aganMediaCard--Root[data-status="completed"] .aganMediaCard--StatusBadge {
    color: #1e3a8a;
    background: #dbeafe;
    border-color: #3b82f6;
  }

  /* 总库导航改成动画画廊使用的紧凑分组布局，保留原有四组按钮与搜索框。 */
  .aganMediaGallery--Navigation {
    gap: 8px 14px;
    margin-bottom: 16px;
    padding: 10px 12px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 14px;
    background: color-mix(in srgb, var(--background-secondary) 62%, transparent);
  }

  .aganMediaGallery--Row {
    gap: 6px;
  }

  .aganMediaGallery--Row + .aganMediaGallery--Row {
    padding-top: 0;
    border-top: 0;
  }

  .aganMediaGallery--RowTop {
    gap: 10px;
  }

  /* 导航分组分隔线：收藏/搜索、类型、状态、排序之间保持清晰层级。 */
  .aganMediaGallery--RowType,
  .aganMediaGallery--RowStatus,
  .aganMediaGallery--RowSort {
    padding-left: 14px;
    border-left: 1px solid color-mix(in srgb, var(--background-modifier-border) 82%, transparent);
  }

  .aganMediaGallery--SearchWrapper {
    flex: 0 1 16rem;
    max-width: 16rem;
  }

  .aganMediaGallery--Search {
    box-sizing: border-box;
    width: 100%;
    min-height: 32px;
    padding: 5px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    background: var(--background-primary);
    color: var(--text-normal);
  }

  .aganMediaGallery--Search:focus {
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 16%, transparent);
  }

  .aganMediaGallery--Toggle,
  .aganMediaGallery--FilterButton,
  .aganMediaGallery--SortButton {
    min-height: 30px;
    margin-right: 0;
    padding: 4px 12px;
    border: 1px solid var(--background-modifier-border);
    border-radius: 999px;
    background: var(--background-primary);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
    color: var(--text-normal);
    font-size: 14px;
    line-height: 1.35;
  }

  .aganMediaGallery--Toggle:hover,
  .aganMediaGallery--FilterButton:hover,
  .aganMediaGallery--SortButton:hover {
    border-color: var(--interactive-accent);
    background: color-mix(in srgb, var(--interactive-accent) 8%, var(--background-primary));
  }

  .aganMediaGallery--Toggle[aria-pressed="true"],
  .aganMediaGallery--FilterButton[aria-pressed="true"],
  .aganMediaGallery--SortButton[aria-pressed="true"] {
    border-color: color-mix(in srgb, var(--interactive-accent) 55%, var(--background-modifier-border));
    background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-primary));
    color: var(--text-normal);
    box-shadow: none;
  }

  @media (max-width: 760px) {
    .aganMediaGallery--Row {
      flex-wrap: wrap;
    }

    .aganMediaGallery--RowType,
    .aganMediaGallery--RowStatus,
    .aganMediaGallery--RowSort {
      padding-left: 0;
      border-left: 0;
    }

    .aganMediaGallery--SearchWrapper {
      flex-basis: 100%;
      max-width: none;
    }
  }

`;

module.exports = {
  id: PLUGIN_ID,
  name: '媒体库-总集合',
  description: '以一套只读通用卡展示总媒体库，并提供集合级筛选、搜索、排序与渐进加载。',
  author: 'agan',
  version: '1.0.0',
  mediaGallery,
  mediaCard,

  install(ctx) {
    const cardRegistered = ctx.registerFieldType({
      type: CARD_FIELD_TYPE,
      label: '媒体卡片',
      icon: 'library',
      order: 103,
      match: ({ api }) => api.getDefinition().source === 'file',
    });
    if (!cardRegistered) throw new Error(`Failed to register ${CARD_FIELD_TYPE}`);

    ctx.registerFieldRenderer({
      id: CARD_RENDERER_ID,
      name: '媒体卡片 Renderer',
      description: '只读展示单张通用媒体卡片。',
      icon: 'library',
      order: -98,
      match: ({ field }) => field.type === CARD_FIELD_TYPE,
      isValueEmpty: () => false,
      view: createMediaCardInstance,
    });

    ctx.registerDatabaseView({
      id: GALLERY_VIEW_TYPE,
      name: '总媒体库',
      icon: 'gallery-horizontal',
      description: '筛选、搜索、排序并渐进展示总媒体库通用卡。',
      view: createMediaGalleryInstance,
    });

    ctx.registerStyleSheet(GALLERY_STYLE);
    return () => undefined;
  },
};
