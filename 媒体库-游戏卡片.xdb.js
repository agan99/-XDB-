const PLUGIN_ID = 'agan-game-card';
const CARD_FIELD_TYPE = 'agan:game-card';
const CARD_RENDERER_ID = 'agan-game-card:renderer';

const TAG_LIMIT = 5;
const TAG_PALETTE_SIZE = 12;
const UNTITLED_GAME = '未命名游戏';
const TITLE_KEYS = Object.freeze(['中文名', '原名', 'name']);
const STATUS_ICON_PATTERN = /^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/u;

// 与 媒体库-动画卡片.xdb.js 的 STATUS_PRESENTATIONS 同构。
// 两个 *.xdb.js 是各自独立加载的插件，无法互相 require，故视觉系统各存一份同构副本。
const GAME_STATUS_KEYS = Object.freeze({
  '💭 未来也许': 'paused',
  '⏳ 待定': 'planned',
  '▶️ 进行中': 'watching',
  '✅ 已完成': 'completed',
});

// 画廊常量：与 媒体库-动画卡片.xdb.js 的 GALLERY_* 同构。
// 差别只有两处：视图类型换命名空间、默认排序的第二个键由动画侧的日期字段换成「发行日期」。
const GALLERY_VIEW_TYPE = 'agan:game-gallery';
const GALLERY_BATCH_SIZE = 24;
const GALLERY_CARD_WIDTH = 330;
const GALLERY_COVER_HEIGHT = 400;
const GALLERY_CARD_MIN_WIDTH = 210;
const GALLERY_GRID_GAP = 12;

const GAME_GALLERY_STATUSES = Object.freeze({
  watching: '▶️ 进行中',
  planned: '⏳ 待定',
  completed: '✅ 已完成',
  paused: '💭 未来也许',
});
const GAME_GALLERY_STATUS_ORDER = Object.freeze([
  GAME_GALLERY_STATUSES.watching,
  GAME_GALLERY_STATUSES.planned,
  GAME_GALLERY_STATUSES.paused,
  GAME_GALLERY_STATUSES.completed,
]);
const GAME_GALLERY_SORTS = Object.freeze({
  release: Object.freeze({ field: '发行日期', defaultDirection: 'desc' }),
  personalRating: Object.freeze({ field: '个人评分', defaultDirection: 'desc' }),
  title: Object.freeze({ field: null, defaultDirection: 'asc' }),
});

function textValue(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function normalizeMinutes(value) {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!/^\d+$/u.test(text)) return null;
    const parsed = Number(text);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

function formatPlaytime(minutes) {
  const total = normalizeMinutes(minutes);
  if (total === null) return null;
  if (total === 0) return '0分钟';
  if (total < 60) return `${total}分钟`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours}小时` : `${hours}小时${rest}分`;
}

function gameInfoLine(platform, minutes) {
  const parts = [];
  const platformLabel = textValue(platform);
  if (platformLabel !== null) parts.push(platformLabel);

  const playtime = formatPlaytime(minutes);
  if (playtime !== null) parts.push(`已游玩 ${playtime}`);

  return parts.length === 0 ? null : parts.join(' · ');
}

function resolveGameTitle(item) {
  const source = item ?? {};
  for (const key of TITLE_KEYS) {
    const value = textValue(source[key]);
    if (value !== null) return value;
  }
  return null;
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

function gameStatusLabel(status) {
  const value = textValue(status);
  if (value === null) return null;

  const stripped = value.replace(STATUS_ICON_PATTERN, '').trim();
  return stripped === '' ? value : stripped;
}

function gameStatusKey(status) {
  const raw = textValue(status);
  if (raw === null) return 'unknown';

  const direct = GAME_STATUS_KEYS[raw];
  if (direct !== undefined) return direct;

  const label = gameStatusLabel(raw);
  for (const [key, value] of Object.entries(GAME_STATUS_KEYS)) {
    if (gameStatusLabel(key) === label) return value;
  }
  return 'unknown';
}

function formatReleaseMonth(value) {
  const normalized = textValue(value);
  const match = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
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
  return `${match[1]}年${match[2]}月`;
}

function ratingPresentation(rating) {
  if (rating == null) return { hasValue: false, label: '' };
  if (typeof rating === 'string' && rating.trim() === '') return { hasValue: false, label: '' };

  const number = typeof rating === 'number' ? rating : Number(String(rating).trim());
  if (!Number.isFinite(number) || number < 0) return { hasValue: false, label: '' };

  return { hasValue: true, label: String(number) };
}

// 标签配色：与 媒体库-动画卡片.xdb.js 的 TAG_COLOR_GROUPS 逐组、逐关键词相同。
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

function gameCardPresentation(item) {
  const source = item ?? {};
  const title = resolveGameTitle(source);

  return {
    cover: textValue(source.cover),
    title: title ?? UNTITLED_GAME,
    hasTitle: title !== null,
    favorite: isFavorite(source['收藏']),
    genre: textValue(source['游戏类型']),
    status: gameStatusLabel(source['状态']),
    statusKey: gameStatusKey(source['状态']),
    releaseMonth: formatReleaseMonth(source['发行日期']),
    rating: ratingPresentation(source['个人评分']),
    tags: firstTags(source.tags),
    infoLine: gameInfoLine(source['游玩平台'], source['游玩分钟']),
  };
}

// --- 游戏卡片墙画廊：状态与纯函数（全部同步、无副作用，供测试直接调用） ---

function collectGalleryRows(groups) {
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

function createGameGalleryState() {
  return {
    status: null,
    favoriteOnly: false,
    unknownPlaytimeOnly: false,
    query: '',
    sort: null,
    visibleCount: GALLERY_BATCH_SIZE,
  };
}

function toggleGameGalleryStatus(state, status) {
  return { ...state, status: state.status === status ? null : status };
}

function cycleGameGallerySort(currentSort, key) {
  const definition = GAME_GALLERY_SORTS[key];
  if (!definition) return currentSort;
  if (!currentSort || currentSort.key !== key) {
    return { key, direction: definition.defaultDirection };
  }
  if (currentSort.direction === definition.defaultDirection) {
    return { key, direction: definition.defaultDirection === 'asc' ? 'desc' : 'asc' };
  }
  return null;
}

function clearGameGalleryConditions(state) {
  return {
    ...state,
    status: null,
    favoriteOnly: false,
    unknownPlaytimeOnly: false,
    query: '',
  };
}

// 与卡片 formatPlaytime() 的判据同源：只有非负整数分钟算有效记录。
function isGamePlaytimeUnknown(item) {
  return normalizeMinutes(item?.['游玩分钟']) === null;
}

function countGameGalleryRows(rows) {
  const counts = {
    all: rows.length,
    watching: 0,
    planned: 0,
    completed: 0,
    paused: 0,
    favorite: 0,
    unknownPlaytime: 0,
  };
  const statusKeys = new Map(
    Object.entries(GAME_GALLERY_STATUSES).map(([key, value]) => [value, key]),
  );

  for (const row of rows) {
    const item = row?.$item ?? {};
    const statusKey = statusKeys.get(item['状态']);
    if (statusKey) counts[statusKey] += 1;
    if (item['收藏'] === true) counts.favorite += 1;
    if (isGamePlaytimeUnknown(item)) counts.unknownPlaytime += 1;
  }
  return counts;
}

function gameGallerySearchTerms(query) {
  const normalized = typeof query === 'string' ? query.trim().toLocaleLowerCase() : '';
  return normalized === '' ? [] : normalized.split(/\s+/u);
}

function gameGallerySearchValues(item) {
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  return [item?.['中文名'], item?.['原名'], ...tags]
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLocaleLowerCase());
}

function filterGameGalleryRows(rows, state) {
  const expectedStatus = state.status === null ? null : GAME_GALLERY_STATUSES[state.status];
  const terms = gameGallerySearchTerms(state.query);

  return rows.filter((row) => {
    const item = row?.$item ?? {};
    if (expectedStatus !== null && item['状态'] !== expectedStatus) return false;
    if (state.favoriteOnly && item['收藏'] !== true) return false;
    if (state.unknownPlaytimeOnly && !isGamePlaytimeUnknown(item)) return false;
    if (terms.length === 0) return true;
    const values = gameGallerySearchValues(item);
    return terms.every((term) => values.some((value) => value.includes(term)));
  });
}

function gameReleaseDateValue(value) {
  const normalized = textValue(value);
  if (normalized === null || !/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return null;
  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(timestamp) && formatReleaseMonth(normalized) !== null ? timestamp : null;
}

function gameRatingValue(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const normalized = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function compareGameTitles(left, right) {
  // 游戏笔记理论上总有 name，但缺标题的行不该让整个画廊崩掉。
  const leftTitle = resolveGameTitle(left?.$item ?? {}) ?? '';
  const rightTitle = resolveGameTitle(right?.$item ?? {}) ?? '';
  return leftTitle.localeCompare(rightTitle, 'zh-CN', { sensitivity: 'base', numeric: true });
}

function compareNullableGameValues(left, right, direction, compareValues) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const result = compareValues(left, right);
  return direction === 'asc' ? result : -result;
}

function sortGameGalleryRows(rows, sort) {
  const indexed = rows.map((row, index) => ({ row, index }));
  const statusRank = new Map(GAME_GALLERY_STATUS_ORDER.map((status, index) => [status, index]));

  indexed.sort((leftEntry, rightEntry) => {
    const left = leftEntry.row;
    const right = rightEntry.row;
    let result = 0;

    if (sort === null) {
      const leftRank = statusRank.get(left?.$item?.['状态']) ?? GAME_GALLERY_STATUS_ORDER.length;
      const rightRank = statusRank.get(right?.$item?.['状态']) ?? GAME_GALLERY_STATUS_ORDER.length;
      result = leftRank - rightRank;
      if (result === 0) {
        result = compareNullableGameValues(
          gameReleaseDateValue(left?.$item?.['发行日期']),
          gameReleaseDateValue(right?.$item?.['发行日期']),
          'desc',
          (a, b) => a - b,
        );
      }
    } else {
      const definition = GAME_GALLERY_SORTS[sort.key];
      if (definition) {
        if (sort.key === 'title') {
          result = sort.direction === 'asc'
            ? compareGameTitles(left, right)
            : compareGameTitles(right, left);
        } else {
          const valueOf = definition.field === '发行日期' ? gameReleaseDateValue : gameRatingValue;
          result = compareNullableGameValues(
            valueOf(left?.$item?.[definition.field]),
            valueOf(right?.$item?.[definition.field]),
            sort.direction,
            (a, b) => a - b,
          );
        }
      }
    }

    if (result === 0 && sort?.key !== 'title') result = compareGameTitles(left, right);
    return result === 0 ? leftEntry.index - rightEntry.index : result;
  });

  return indexed.map((entry) => entry.row);
}

function resolveGameGallery(rows, state) {
  const filtered = filterGameGalleryRows(rows, state);
  const sorted = sortGameGalleryRows(filtered, state.sort);
  return {
    counts: countGameGalleryRows(rows),
    allResults: sorted,
    visibleRows: sorted.slice(0, state.visibleCount),
  };
}

function nextGameGalleryVisibleCount(current, total) {
  return Math.min(total, Math.max(GALLERY_BATCH_SIZE, current) + GALLERY_BATCH_SIZE);
}

const gameGallery = Object.freeze({
  batchSize: GALLERY_BATCH_SIZE,
  statuses: GAME_GALLERY_STATUSES,
  sorts: GAME_GALLERY_SORTS,
  collectRows: collectGalleryRows,
  createState: createGameGalleryState,
  toggleStatus: toggleGameGalleryStatus,
  cycleSort: cycleGameGallerySort,
  clearConditions: clearGameGalleryConditions,
  isUnknownPlaytime: isGamePlaytimeUnknown,
  countRows: countGameGalleryRows,
  filterRows: filterGameGalleryRows,
  sortRows: sortGameGalleryRows,
  resolve: resolveGameGallery,
  nextVisibleCount: nextGameGalleryVisibleCount,
});

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCover(presentation) {
  const area = element('section', 'aganGameCard--CoverArea');

  const frame = element('div', 'aganGameCard--CoverFrame');
  const placeholder = element('div', 'aganGameCard--CoverPlaceholder', '暂无封面');
  frame.appendChild(placeholder);

  if (presentation.cover === null) {
    frame.dataset.state = 'empty';
  } else {
    const image = element('img', 'aganGameCard--Cover');
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

  const coverTop = element('div', 'aganGameCard--CoverTop');
  if (presentation.genre !== null) {
    coverTop.appendChild(
      element('span', 'aganGameCard--Badge aganGameCard--TypeBadge', presentation.genre),
    );
  }
  if (presentation.status !== null) {
    coverTop.appendChild(
      element('span', 'aganGameCard--Badge aganGameCard--StatusBadge', presentation.status),
    );
  }
  area.appendChild(coverTop);

  const coverBottom = element('div', 'aganGameCard--CoverBottom');
  if (presentation.releaseMonth !== null) {
    coverBottom.appendChild(
      element('span', 'aganGameCard--MetaBadge', presentation.releaseMonth),
    );
  }
  if (presentation.rating.hasValue) {
    coverBottom.appendChild(
      element(
        'span',
        'aganGameCard--MetaBadge aganGameCard--Rating',
        `★ ${presentation.rating.label}`,
      ),
    );
  }
  area.appendChild(coverBottom);

  return area;
}

function renderBody(presentation) {
  const body = element('section', 'aganGameCard--Body');

  const title = element(
    'div',
    'aganGameCard--Title',
    `${presentation.favorite ? '★ ' : ''}${presentation.title}`,
  );
  title.dataset.empty = String(!presentation.hasTitle);
  body.appendChild(title);

  if (presentation.tags.length > 0) {
    const tagRow = element('div', 'aganGameCard--Tags');
    for (const tag of presentation.tags) {
      const chip = element('span', 'aganGameCard--Tag', tag);
      chip.dataset.color = tagColorKey(tag);
      tagRow.appendChild(chip);
    }
    body.appendChild(tagRow);
  }

  if (presentation.infoLine !== null) {
    body.appendChild(element('div', 'aganGameCard--Info', presentation.infoLine));
  }

  return body;
}

function createGameCardInstance() {
  return {
    onUpdate(props) {
      const presentation = gameCardPresentation(props.row?.$item);

      const root = element('article', 'aganGameCard--Root');
      root.dataset.status = presentation.statusKey;
      root.appendChild(renderCover(presentation));
      root.appendChild(renderBody(presentation));

      props.container.replaceChildren(root);
    },

    onDestroy() {},
  };
}

function createGameGalleryInstance() {
  let destroyed = false;
  let latestProps = null;
  let state = gameGallery.createState();
  let root = null;
  let grid = null;
  let resultsArea = null;
  let emptyState = null;
  let searchInput = null;
  let sentinel = null;
  let intersectionObserver = null;
  let resizeObserver = null;
  let currentResults = [];
  const cards = new Map();
  const statusButtons = new Map();
  const additionalButtons = new Map();
  const sortButtons = new Map();

  function destroyCard(rowId) {
    const card = cards.get(rowId);
    if (!card) return;
    card.instance.onDestroy();
    card.slot.remove();
    cards.delete(rowId);
  }

  function resetAndRender(nextState) {
    state = { ...nextState, visibleCount: GALLERY_BATCH_SIZE };
    render();
  }

  function createToggleButton(label, onClick) {
    const button = element('button', 'aganGameGallery--FilterButton', label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function ensureDom(props) {
    if (root !== null) return;

    root = element('section', 'aganGameGallery--Root');
    const heading = element('h2', 'aganGameGallery--Heading', '游戏卡片墙');
    const filters = element('div', 'aganGameGallery--Filters');
    const statusGroup = element('div', 'aganGameGallery--FilterGroup');
    const allButton = createToggleButton('全部', () => {
      resetAndRender({ ...state, status: null });
    });
    statusButtons.set('all', allButton);
    statusGroup.appendChild(allButton);
    for (const [key, label] of [
      ['watching', '在玩'],
      ['planned', '想玩'],
      ['completed', '已玩'],
      ['paused', '暂缓'],
    ]) {
      const button = createToggleButton(label, () => {
        resetAndRender(gameGallery.toggleStatus(state, key));
      });
      statusButtons.set(key, button);
      statusGroup.appendChild(button);
    }

    const additionalGroup = element('div', 'aganGameGallery--FilterGroup');
    const favoriteButton = createToggleButton('★ 收藏', () => {
      resetAndRender({ ...state, favoriteOnly: !state.favoriteOnly });
    });
    const unknownButton = createToggleButton('时长未知', () => {
      resetAndRender({ ...state, unknownPlaytimeOnly: !state.unknownPlaytimeOnly });
    });
    additionalButtons.set('favorite', favoriteButton);
    additionalButtons.set('unknownPlaytime', unknownButton);
    additionalGroup.append(favoriteButton, unknownButton);
    filters.append(statusGroup, additionalGroup);

    const tools = element('div', 'aganGameGallery--Tools');
    searchInput = element('input', 'aganGameGallery--Search');
    searchInput.type = 'search';
    searchInput.placeholder = '搜索中文名、原名或标签';
    searchInput.setAttribute('aria-label', '搜索游戏');
    searchInput.addEventListener('input', () => {
      resetAndRender({ ...state, query: searchInput.value });
    });
    const sortGroup = element('div', 'aganGameGallery--SortGroup');
    for (const [key, label] of [
      ['release', '发行日期'],
      ['personalRating', '个人评分'],
      ['title', '标题'],
    ]) {
      const button = element('button', 'aganGameGallery--SortButton', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        resetAndRender({ ...state, sort: gameGallery.cycleSort(state.sort, key) });
      });
      sortButtons.set(key, { button, label });
      sortGroup.appendChild(button);
    }
    tools.append(searchInput, sortGroup);

    resultsArea = element('div', 'aganGameGallery--Results');
    grid = element('div', 'aganGameGallery--Grid');
    emptyState = element('div', 'aganGameGallery--Empty');
    sentinel = element('div', 'aganGameGallery--Sentinel');
    sentinel.setAttribute('aria-hidden', 'true');
    resultsArea.append(grid, emptyState);
    root.append(heading, filters, tools, resultsArea);
    props.container.replaceChildren(root);

    if (typeof IntersectionObserver === 'function') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (destroyed || !entries.some((entry) => entry.isIntersecting)) return;
          const nextCount = gameGallery.nextVisibleCount(state.visibleCount, currentResults.length);
          if (nextCount === state.visibleCount) return;
          intersectionObserver.disconnect();
          const nextRows = currentResults.slice(state.visibleCount, nextCount);
          state = { ...state, visibleCount: nextCount };
          appendCardRows(nextRows);
          if (nextCount < currentResults.length) intersectionObserver.observe(sentinel);
        },
        { rootMargin: '600px 0px' },
      );
    }

    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => {
        if (destroyed || !resultsArea) return;
        const availableWidth = resultsArea.clientWidth;
        if (availableWidth <= 0) return;

        const minWidth = GALLERY_CARD_MIN_WIDTH;
        const columnCount = Math.max(
          1,
          Math.floor((availableWidth + GALLERY_GRID_GAP) / (minWidth + GALLERY_GRID_GAP)),
        );
        const cardWidth = Math.floor(
          (availableWidth - (columnCount - 1) * GALLERY_GRID_GAP) / columnCount,
        );
        if (!Number.isFinite(cardWidth) || cardWidth <= 0) return;

        root.style.setProperty('--agan-game-gallery-card-min-w', `${GALLERY_CARD_MIN_WIDTH}px`);
        root.style.setProperty('--agan-game-gallery-card-w', `${cardWidth}px`);
        root.style.setProperty(
          '--agan-game-gallery-cover-h',
          `${Math.round(cardWidth * (GALLERY_COVER_HEIGHT / GALLERY_CARD_WIDTH))}px`,
        );
        root.dataset.columns = String(columnCount);
      });
      resizeObserver.observe(resultsArea);
    }
  }

  function updateControls(counts) {
    const labels = {
      all: '全部',
      watching: '在玩',
      planned: '想玩',
      completed: '已玩',
      paused: '暂缓',
    };
    for (const [key, button] of statusButtons) {
      button.textContent = `${labels[key]} ${counts[key]}`;
      const active = key === 'all' ? state.status === null : state.status === key;
      button.setAttribute('aria-pressed', String(active));
    }

    const favoriteButton = additionalButtons.get('favorite');
    favoriteButton.textContent = `★ 收藏 ${counts.favorite}`;
    favoriteButton.setAttribute('aria-pressed', String(state.favoriteOnly));
    const unknownButton = additionalButtons.get('unknownPlaytime');
    unknownButton.textContent = `时长未知 ${counts.unknownPlaytime}`;
    unknownButton.setAttribute('aria-pressed', String(state.unknownPlaytimeOnly));
    if (searchInput.value !== state.query) searchInput.value = state.query;

    for (const [key, entry] of sortButtons) {
      const active = state.sort?.key === key;
      const arrow = active ? (state.sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
      entry.button.textContent = `${entry.label}${arrow}`;
      entry.button.setAttribute('aria-pressed', String(active));
    }
  }

  function getOrCreateCard(rowId) {
    let card = cards.get(rowId);
    if (card) return card;
    const slot = element('div', 'aganGameGallery--CardSlot');
    const canvas = element('div', 'aganGameGallery--CardCanvas');
    slot.appendChild(canvas);
    card = { slot, canvas, instance: createGameCardInstance() };
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
    fragment.appendChild(sentinel);
    grid.replaceChildren(fragment);
  }

  function appendCardRows(rows) {
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const card = getOrCreateCard(row.id);
      card.instance.onUpdate({ ...latestProps, container: card.canvas, row });
      fragment.appendChild(card.slot);
    }
    grid.insertBefore(fragment, sentinel);
  }

  function render() {
    if (destroyed || !latestProps) return;
    ensureDom(latestProps);
    const rows = gameGallery.collectRows(latestProps.viewData?.groups);
    const resolved = gameGallery.resolve(rows, state);
    currentResults = resolved.allResults;
    updateControls(resolved.counts);

    intersectionObserver?.disconnect();
    if (rows.length === 0) {
      for (const rowId of Array.from(cards.keys())) destroyCard(rowId);
      grid.replaceChildren();
      emptyState.replaceChildren(
        element('strong', 'aganGameGallery--EmptyTitle', '暂无游戏'),
        element('span', '', '当前游戏库没有可展示记录'),
      );
      emptyState.hidden = false;
    } else if (resolved.allResults.length === 0) {
      for (const rowId of Array.from(cards.keys())) destroyCard(rowId);
      grid.replaceChildren();
      const clear = element('button', '', '清除条件');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        resetAndRender(gameGallery.clearConditions(state));
      });
      emptyState.replaceChildren(
        element('strong', 'aganGameGallery--EmptyTitle', '没有找到匹配的游戏'),
        element('span', '', '调整搜索或筛选条件试试'),
        clear,
      );
      emptyState.hidden = false;
    } else {
      emptyState.hidden = true;
      emptyState.replaceChildren();
      renderCardRows(resolved.visibleRows);
      if (resolved.visibleRows.length < resolved.allResults.length) {
        intersectionObserver?.observe(sentinel);
      }
    }
  }

  return {
    onUpdate(props) {
      latestProps = props;
      ensureDom(props);
      render();
    },

    onDestroy() {
      destroyed = true;
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
      intersectionObserver = null;
      resizeObserver = null;
      for (const rowId of Array.from(cards.keys())) destroyCard(rowId);
      cards.clear();
      root = null;
      grid = null;
      resultsArea = null;
      emptyState = null;
      searchInput = null;
      sentinel = null;
      latestProps = null;
    },
  };
}

const gameCard = Object.freeze({
  gameCardPresentation,
  resolveGameTitle,
  isFavorite,
  firstTags,
  gameStatusLabel,
  gameStatusKey,
  formatReleaseMonth,
  ratingPresentation,
  tagColorKey,
  normalizeMinutes,
  formatPlaytime,
  gameInfoLine,
});

module.exports = {
  id: PLUGIN_ID,
  name: '媒体库-游戏卡片',
  description: '展示基于游戏笔记标准属性的单张游戏卡片，并提供游戏卡片墙画廊。',
  author: 'agan',
  version: '1.2.0',
  gameCard,
  gameGallery,

  install(ctx) {
    const cardRegistered = ctx.registerFieldType({
      type: CARD_FIELD_TYPE,
      label: '游戏卡片',
      icon: 'gamepad2',
      order: 102,
      match: ({ api }) => api.getDefinition().source === 'file',
    });
    if (!cardRegistered) throw new Error(`Failed to register ${CARD_FIELD_TYPE}`);

    ctx.registerFieldRenderer({
      id: CARD_RENDERER_ID,
      name: '游戏卡片 Renderer',
      description: '展示单张游戏卡片。',
      icon: 'gamepad2',
      order: -98,
      match: ({ field }) => field.type === CARD_FIELD_TYPE,
      isValueEmpty: () => false,
      view: createGameCardInstance,
    });

    ctx.registerDatabaseView({
      id: GALLERY_VIEW_TYPE,
      name: '游戏卡片墙',
      icon: 'layoutGrid',
      description: '筛选、搜索、排序并渐进展示游戏卡片。',
      view: createGameGalleryInstance,
    });

    ctx.registerStyleSheet(`
      .aganGameCard--Root {
        box-sizing: border-box;
        width: min(100%, 330px);
        overflow: hidden;
        border: 1px solid var(--background-modifier-border);
        border-radius: 16px;
        background: var(--background-primary-alt);
        color: var(--text-normal);
        white-space: normal;
        box-shadow: var(--shadow-s);
      }

      .aganGameCard--CoverArea {
        position: relative;
        width: 100%;
        aspect-ratio: 330 / 400;
        overflow: hidden;
        background: var(--background-secondary);
      }

      .aganGameCard--CoverArea::after {
        content: "";
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 42%;
        pointer-events: none;
        background: linear-gradient(transparent, rgb(0 0 0 / 0.42));
      }

      .aganGameCard--CoverFrame {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        overflow: hidden;
      }

      .aganGameCard--Cover {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .aganGameCard--CoverPlaceholder {
        padding: 0 var(--size-4-3);
        color: var(--text-faint);
        font-size: var(--font-ui-smaller);
        text-align: center;
      }

      .aganGameCard--CoverFrame[data-state="ready"] .aganGameCard--CoverPlaceholder {
        display: none;
      }

      .aganGameCard--CoverFrame[data-state="error"] .aganGameCard--CoverPlaceholder {
        color: var(--text-muted);
      }

      .aganGameCard--CoverTop,
      .aganGameCard--CoverBottom {
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

      .aganGameCard--CoverTop {
        top: var(--size-4-3);
      }

      .aganGameCard--CoverBottom {
        bottom: var(--size-4-3);
      }

      .aganGameCard--Badge,
      .aganGameCard--MetaBadge {
        flex: 0 0 auto;
        box-sizing: border-box;
        min-height: 1.375rem;
        padding: 2px 8px;
        border: 1px solid rgb(0 0 0 / 0.1);
        border-radius: 8px;
        color: #1f1c19;
        background: rgb(255 255 255 / 0.96);
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.22);
        font-size: 11px;
        line-height: 1.35;
        white-space: nowrap;
        pointer-events: auto;
      }

      .aganGameCard--Root[data-status="paused"] .aganGameCard--StatusBadge {
        color: #374151;
        background: #e5e7eb;
        border-color: #6b7280;
      }

      .aganGameCard--Root[data-status="planned"] .aganGameCard--StatusBadge {
        color: #713f12;
        background: #fef9c3;
        border-color: #eab308;
      }

      .aganGameCard--Root[data-status="watching"] .aganGameCard--StatusBadge {
        color: #14532d;
        background: #dcfce7;
        border-color: #22c55e;
      }

      .aganGameCard--Root[data-status="completed"] .aganGameCard--StatusBadge {
        color: #1e3a8a;
        background: #dbeafe;
        border-color: #3b82f6;
      }

      .aganGameCard--Rating {
        min-width: 3.25rem;
        text-align: center;
      }

      .aganGameCard--Body {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-3);
        padding: var(--size-4-3);
      }

      .aganGameCard--Title {
        display: -webkit-box;
        width: 100%;
        min-height: 2.6em;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        font-size: 17px;
        font-weight: var(--font-semibold);
        line-height: 1.3;
        text-align: left;
      }

      .aganGameCard--Title[data-empty="true"] {
        color: var(--text-faint);
      }

      .aganGameCard--Tags {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        gap: 4px;
        height: calc(2 * (1.4em + 4px) + 4px);
        overflow: hidden;
        font-size: 11px;
        line-height: 1.4;
      }

      .aganGameCard--Tag {
        flex: 0 0 auto;
        padding: 1px 7px;
        border: 1px solid transparent;
        border-radius: 5px;
        background: var(--background-secondary);
        color: var(--text-muted);
        letter-spacing: 0.01em;
        white-space: nowrap;
      }

      .aganGameCard--Tag[data-color="t0"] {
        background: #fde2e4;
        color: #9d2449;
      }

      .aganGameCard--Tag[data-color="t1"] {
        background: #ffe4e6;
        color: #9f1239;
      }

      .aganGameCard--Tag[data-color="t2"] {
        background: #ffedd5;
        color: #9a3412;
      }

      .aganGameCard--Tag[data-color="t3"] {
        background: #d1fae5;
        color: #065f46;
      }

      .aganGameCard--Tag[data-color="t4"] {
        background: #fee2e2;
        color: #991b1b;
      }

      .aganGameCard--Tag[data-color="t5"] {
        background: #ede9fe;
        color: #5b21b6;
      }

      .aganGameCard--Tag[data-color="t6"] {
        background: #cffafe;
        color: #155e75;
      }

      .aganGameCard--Tag[data-color="t7"] {
        background: #f3e8ff;
        color: #6b21a8;
      }

      .aganGameCard--Tag[data-color="t8"] {
        background: #dbeafe;
        color: #1e40af;
      }

      .aganGameCard--Tag[data-color="t9"] {
        background: #fce7f3;
        color: #9d174d;
      }

      .aganGameCard--Tag[data-color="t10"] {
        background: #dcfce7;
        color: #166534;
      }

      .aganGameCard--Tag[data-color="t11"] {
        background: #fef3c7;
        color: #92400e;
      }

      .aganGameCard--Info {
        display: flex;
        align-items: center;
        min-height: 1.75rem;
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
      }

      /* --- 游戏卡片墙：与 媒体库-动画卡片.xdb.js 的画廊样式同构 --- */

      .aganGameGallery--Root {
        --agan-game-gallery-card-min-w: 210px;
        /* 卡片宽度由 ResizeObserver 按可视宽度写回；这里仅供首帧使用。 */
        --agan-game-gallery-card-w: 210px;
        --agan-game-gallery-cover-h: 255px;
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        overflow-x: clip;
        padding: 18px clamp(12px, 2%, 28px) 32px;
        color: var(--text-normal);
      }

      .aganGameGallery--Heading {
        margin: 0 0 12px;
        font-size: 22px;
        font-weight: 700;
        line-height: 1.3;
      }

      .aganGameGallery--Filters,
      .aganGameGallery--FilterGroup,
      .aganGameGallery--Tools,
      .aganGameGallery--SortGroup {
        display: flex;
        align-items: center;
        gap: var(--size-2-2);
      }

      .aganGameGallery--Filters,
      .aganGameGallery--Tools,
      .aganGameGallery--SortGroup {
        flex-wrap: wrap;
      }

      .aganGameGallery--Filters {
        justify-content: space-between;
        margin-bottom: var(--size-4-3);
      }

      .aganGameGallery--FilterGroup {
        flex-wrap: wrap;
      }

      .aganGameGallery--Tools {
        margin-bottom: 12px;
      }

      .aganGameGallery--Search {
        flex: 0 1 16rem;
        min-width: 0;
        max-width: 16rem;
      }

      .aganGameGallery--FilterButton,
      .aganGameGallery--SortButton {
        margin-right: 4px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        font-size: 15px;
      }

      .aganGameGallery--FilterButton[aria-pressed="true"],
      .aganGameGallery--SortButton[aria-pressed="true"] {
        border-color: transparent;
        color: var(--text-on-accent);
        background: var(--interactive-accent);
      }

      .aganGameGallery--Results {
        width: 100%;
        min-width: 0;
        overflow-x: clip;
      }

      .aganGameGallery--Grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fill,
          minmax(min(var(--agan-game-gallery-card-min-w), 100%), 1fr)
        );
        justify-content: start;
        align-items: start;
        gap: 12px;
        width: 100%;
      }

      .aganGameGallery--CardSlot {
        position: relative;
        width: 100%;
        min-width: 0;
        height: auto;
        overflow: visible;
        transition: transform 160ms ease;
      }

      @media (hover: hover) {
        .aganGameGallery--CardSlot:hover {
          z-index: 1;
          transform: translateY(-2px);
        }
      }

      .aganGameGallery--CardSlot:focus-within {
        z-index: 1;
        transform: translateY(-2px);
      }

      @media (prefers-reduced-motion: reduce) {
        .aganGameGallery--CardSlot {
          transition: none;
        }

        .aganGameGallery--CardSlot:hover,
        .aganGameGallery--CardSlot:focus-within {
          transform: none;
        }
      }

      .aganGameGallery--CardCanvas {
        width: 100%;
        min-width: 0;
        height: auto;
      }

      .aganGameGallery--CardCanvas .aganGameCard--Root {
        display: grid;
        grid-template-rows: var(--agan-game-gallery-cover-h) auto;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        height: auto;
      }

      .aganGameGallery--CardCanvas .aganGameCard--CoverArea {
        height: var(--agan-game-gallery-cover-h);
        aspect-ratio: auto;
      }

      .aganGameGallery--CardCanvas .aganGameCard--Body {
        min-height: 0;
        overflow: hidden;
      }

      .aganGameGallery--Sentinel {
        grid-column: 1 / -1;
        width: 100%;
        height: 1px;
      }

      .aganGameGallery--Empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--size-2-3);
        padding: var(--size-4-6) 0;
        color: var(--text-muted);
      }

      .aganGameGallery--Empty[hidden] {
        display: none;
      }

      .aganGameGallery--EmptyTitle {
        color: var(--text-normal);
        font-size: var(--font-ui-medium);
      }

      @media (max-width: 540px) {
        .aganGameGallery--Tools {
          align-items: stretch;
        }

        .aganGameGallery--Search,
        .aganGameGallery--SortGroup {
          flex-basis: 100%;
        }
      }

      .theme-light .aganGameGallery--Root {
        color: var(--text-normal);
        background: transparent;
      }

      .theme-light .aganGameGallery--Heading {
        margin-bottom: 14px;
        padding: 14px 18px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 14px;
        background: color-mix(in srgb, var(--background-secondary) 82%, transparent);
        color: var(--text-normal);
        font-size: 20px;
      }

      .theme-light .aganGameGallery--Heading::before {
        content: "🎮";
        margin-right: 8px;
      }

      .theme-light .aganGameGallery--Filters {
        gap: 8px 16px;
        margin-bottom: 12px;
        padding: 2px 0 0;
        border: 0;
        background: transparent;
      }

      .theme-light .aganGameGallery--FilterGroup,
      .theme-light .aganGameGallery--SortGroup {
        gap: 6px;
      }

      .theme-light .aganGameGallery--Tools {
        gap: 9px 14px;
        margin-bottom: 14px;
      }

      .theme-light .aganGameGallery--Search {
        min-height: 32px;
        padding: 5px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 999px;
        background: var(--background-primary);
        box-shadow: none;
        color: var(--text-normal);
      }

      .theme-light .aganGameGallery--Search::placeholder {
        color: var(--text-faint);
      }

      .theme-light .aganGameGallery--Search:focus {
        border-color: var(--interactive-accent);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 16%, transparent);
      }

      .aganGameGallery--Tools {
        flex-wrap: nowrap;
      }

      @media (max-width: 760px) {
        .aganGameGallery--Tools {
          flex-wrap: wrap;
        }

        .aganGameGallery--Search {
          flex-basis: 100%;
          max-width: none;
        }
      }

      .theme-light .aganGameGallery--FilterButton,
      .theme-light .aganGameGallery--SortButton {
        min-height: 30px;
        margin-right: 0;
        padding: 4px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 999px;
        background: var(--background-primary);
        box-shadow: 0 1px 2px rgb(0 0 0 / 0.04);
        color: var(--text-normal);
        font-size: 15px;
        line-height: 1.35;
      }

      .theme-light .aganGameGallery--FilterButton:hover,
      .theme-light .aganGameGallery--SortButton:hover {
        border-color: var(--interactive-accent);
        background: color-mix(in srgb, var(--interactive-accent) 8%, var(--background-primary));
        color: var(--text-normal);
      }

      .theme-light .aganGameGallery--FilterButton[aria-pressed="true"],
      .theme-light .aganGameGallery--SortButton[aria-pressed="true"] {
        border-color: var(--interactive-accent);
        background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-primary));
        color: var(--text-normal);
        box-shadow: none;
      }

      .theme-light .aganGameGallery--Empty {
        color: var(--text-muted);
      }

      .theme-light .aganGameGallery--EmptyTitle {
        color: var(--text-normal);
      }

      /* 游戏卡片与动画卡片共用封面角标语言：深色类型/日期，
         按状态着色，评分使用深棕金色。仅调整展示层。 */
      .aganGameCard--Badge,
      .aganGameCard--MetaBadge {
        min-height: 1.75rem;
        padding: 3px 10px;
        border-radius: 999px;
        border-color: rgb(255 255 255 / 0.18);
        box-shadow: 0 2px 5px rgb(22 18 28 / 0.2);
        font-size: 12px;
        font-weight: 600;
      }

      .aganGameCard--TypeBadge,
      .aganGameCard--MetaBadge {
        border-color: rgb(255 255 255 / 0.18);
        background: rgb(42 36 50 / 0.76);
        color: #fff;
      }

      .aganGameCard--Rating {
        min-width: 3.25rem;
        justify-content: center;
        border-color: rgb(250 214 127 / 0.3);
        background: rgb(51 42 40 / 0.86);
        color: #f9dc80;
      }

      .aganGameCard--Root[data-status="paused"] .aganGameCard--StatusBadge {
        color: #374151;
        background: #e5e7eb;
        border-color: #6b7280;
      }

      .aganGameCard--Root[data-status="planned"] .aganGameCard--StatusBadge {
        color: #713f12;
        background: #fef9c3;
        border-color: #eab308;
      }

      .aganGameCard--Root[data-status="watching"] .aganGameCard--StatusBadge {
        color: #14532d;
        background: #dcfce7;
        border-color: #22c55e;
      }

      .aganGameCard--Root[data-status="completed"] .aganGameCard--StatusBadge {
        color: #1e3a8a;
        background: #dbeafe;
        border-color: #3b82f6;
      }
    `);

    return () => undefined;
  },
};
