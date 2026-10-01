const PLUGIN_ID = 'agan-anime-media-progress';
const FIELD_TYPE = 'agan:anime-media-progress';
const RENDERER_ID = 'agan-anime-media-progress:renderer';
const CARD_FIELD_TYPE = 'agan:anime-card';
const CARD_RENDERER_ID = 'agan-anime-media-progress:anime-card-renderer';
const GALLERY_VIEW_TYPE = 'agan:anime-gallery';
const GALLERY_BATCH_SIZE = 24;
const GALLERY_CARD_WIDTH = 330;
const GALLERY_COVER_HEIGHT = 400;
const GALLERY_CARD_MIN_WIDTH = 210;
const GALLERY_GRID_GAP = 12;
const MARKER = '**已观看集数**：';
const MARKER_PATTERN = /^\*\*已观看集数\*\*：[^\r\n]*$/gmu;

const STATUS_PRESENTATIONS = Object.freeze({
  '💭 未来也许': Object.freeze({ key: 'paused', label: '暂缓', canQuickToggle: false }),
  '⏳ 待定': Object.freeze({ key: 'planned', label: '想看', canQuickToggle: false }),
  '▶️ 进行中': Object.freeze({ key: 'watching', label: '在看', canQuickToggle: true }),
  '✅ 已完成': Object.freeze({ key: 'completed', label: '已看', canQuickToggle: true }),
});

class MediaProgressError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'MediaProgressError';
    this.code = code;
  }
}

function normalizeTotal(total) {
  if (total == null || (typeof total === 'string' && total.trim() === '')) return null;

  const normalized =
    typeof total === 'string' && /^\d+$/u.test(total.trim()) ? Number(total.trim()) : total;

  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new MediaProgressError('INVALID_TOTAL', '总集数必须为空或大于等于 0 的整数');
  }
  return normalized;
}

function locateCurrent(body) {
  if (typeof body !== 'string') {
    throw new MediaProgressError('INVALID_BODY', '正文必须是字符串');
  }

  const matches = Array.from(body.matchAll(MARKER_PATTERN));
  if (matches.length === 0) {
    throw new MediaProgressError('MISSING_MARKER', '正文缺少唯一的「已观看集数」标记');
  }
  if (matches.length > 1) {
    throw new MediaProgressError('DUPLICATE_MARKER', '正文存在多个「已观看集数」标记');
  }

  const match = matches[0];
  const rawValue = match[0].slice(MARKER.length).trim();
  if (rawValue === '') {
    return { current: null, index: match.index, length: match[0].length };
  }
  if (!/^\d+$/u.test(rawValue)) {
    throw new MediaProgressError('INVALID_CURRENT', '已观看集数必须为空或大于等于 0 的整数');
  }

  const current = Number(rawValue);
  if (!Number.isSafeInteger(current)) {
    throw new MediaProgressError('INVALID_CURRENT', '已观看集数超出安全整数范围');
  }
  return { current, index: match.index, length: match[0].length };
}

const mediaProgress = Object.freeze({
  read(body, total) {
    const located = locateCurrent(body);
    const normalizedTotal = normalizeTotal(total);
    const canDerive = located.current !== null && normalizedTotal !== null && normalizedTotal > 0;

    return {
      current: located.current,
      total: normalizedTotal,
      unit: '集',
      percentage: canDerive ? (located.current / normalizedTotal) * 100 : null,
      reachedTotal: canDerive ? located.current >= normalizedTotal : null,
    };
  },

  updateBody(body, total, newCurrent) {
    if (!Number.isSafeInteger(newCurrent) || newCurrent < 0) {
      throw new MediaProgressError('INVALID_NEW_CURRENT', '新的已观看集数必须是大于等于 0 的整数');
    }

    const normalizedTotal = normalizeTotal(total);
    if (normalizedTotal !== null && newCurrent > normalizedTotal) {
      throw new MediaProgressError(
        'EXCEEDS_TOTAL',
        `新的已观看集数 ${newCurrent} 不能超过总集数 ${normalizedTotal}`,
      );
    }

    const located = locateCurrent(body);
    const nextLine = `${MARKER} ${newCurrent}`;
    return body.slice(0, located.index) + nextLine + body.slice(located.index + located.length);
  },
});

function textValue(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function resolveAnimeTitle(item) {
  return (
    textValue(item?.['中文名']) ??
    textValue(item?.['原名']) ??
    textValue(item?.name) ??
    '未命名动画'
  );
}

function statusPresentation(status) {
  return (
    STATUS_PRESENTATIONS[status] ??
    Object.freeze({ key: 'unknown', label: '未知', canQuickToggle: false })
  );
}

function nextQuickStatus(status) {
  if (status === '▶️ 进行中') return '✅ 已完成';
  if (status === '✅ 已完成') return '▶️ 进行中';
  return null;
}

function firstTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag) => typeof tag === 'string' && tag.trim() !== '').slice(0, 5);
}

// 标签配色：先查语义分组，查不到再用稳定哈希落到兜底色板。
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
const TAG_PALETTE_SIZE = 12;

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

function ratingPresentation(rating) {
  if (rating == null || (typeof rating === 'string' && rating.trim() === '')) {
    return { hasValue: false, label: '' };
  }
  return { hasValue: true, label: String(rating) };
}

function formatPremiereMonth(value) {
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

function descriptionPresentation(description) {
  const value = textValue(description);
  return value === null ? { mode: 'empty', value: '' } : { mode: 'view', value };
}

function progressPresentation(progress, status) {
  const percentageLabel =
    progress.percentage === null ? null : `${Math.round(progress.percentage)}%`;
  const fillPercentage =
    progress.percentage === null ? null : Math.max(0, Math.min(100, progress.percentage));
  const hasCurrent = progress.current !== null;
  const totalAllowsIncrement = progress.total === null || progress.current < progress.total;

  return {
    currentLabel: hasCurrent ? String(progress.current) : '?',
    totalLabel: progress.total === null ? '?' : String(progress.total),
    percentageLabel,
    fillPercentage,
    reachedTotal: progress.reachedTotal,
    showStepControls: status === '▶️ 进行中',
    canDecrement: hasCurrent && progress.current > 0,
    canIncrement: hasCurrent && totalAllowsIncrement,
  };
}

const animeCard = Object.freeze({
  resolveTitle: resolveAnimeTitle,
  statusPresentation,
  nextQuickStatus,
  firstTags,
  tagColorKey,
  ratingPresentation,
  formatPremiereMonth,
  descriptionPresentation,
  progressPresentation,
});

const GALLERY_STATUSES = Object.freeze({
  watching: '▶️ 进行中',
  planned: '⏳ 待定',
  completed: '✅ 已完成',
  paused: '💭 未来也许',
});
const GALLERY_DEFAULT_STATUS_ORDER = Object.freeze([
  GALLERY_STATUSES.watching,
  GALLERY_STATUSES.planned,
  GALLERY_STATUSES.paused,
  GALLERY_STATUSES.completed,
]);
const GALLERY_SORTS = Object.freeze({
  premiere: Object.freeze({ field: '开播日期', defaultDirection: 'desc' }),
  personalRating: Object.freeze({ field: '个人评分', defaultDirection: 'desc' }),
  title: Object.freeze({ field: null, defaultDirection: 'asc' }),
});

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

function createGalleryState() {
  return {
    status: null,
    favoriteOnly: false,
    unknownTotalOnly: false,
    query: '',
    sort: null,
    visibleCount: GALLERY_BATCH_SIZE,
  };
}

function toggleGalleryStatus(state, status) {
  return { ...state, status: state.status === status ? null : status };
}

function cycleGallerySort(currentSort, key) {
  const definition = GALLERY_SORTS[key];
  if (!definition) return currentSort;
  if (!currentSort || currentSort.key !== key) {
    return { key, direction: definition.defaultDirection };
  }
  if (currentSort.direction === definition.defaultDirection) {
    return { key, direction: definition.defaultDirection === 'asc' ? 'desc' : 'asc' };
  }
  return null;
}

function clearGalleryConditions(state) {
  return {
    ...state,
    status: null,
    favoriteOnly: false,
    unknownTotalOnly: false,
    query: '',
  };
}

function isGalleryTotalUnknown(item) {
  try {
    return normalizeTotal(item?.['总集数']) === null;
  } catch {
    return false;
  }
}

function countGalleryRows(rows) {
  const counts = {
    all: rows.length,
    watching: 0,
    planned: 0,
    completed: 0,
    paused: 0,
    favorite: 0,
    unknownTotal: 0,
  };
  const statusKeys = new Map(Object.entries(GALLERY_STATUSES).map(([key, value]) => [value, key]));

  for (const row of rows) {
    const item = row?.$item ?? {};
    const statusKey = statusKeys.get(item['状态']);
    if (statusKey) counts[statusKey] += 1;
    if (item['收藏'] === true) counts.favorite += 1;
    if (isGalleryTotalUnknown(item)) counts.unknownTotal += 1;
  }
  return counts;
}

function gallerySearchTerms(query) {
  const normalized = typeof query === 'string' ? query.trim().toLocaleLowerCase() : '';
  return normalized === '' ? [] : normalized.split(/\s+/u);
}

function gallerySearchValues(item) {
  const tags = Array.isArray(item?.tags) ? item.tags : [];
  return [item?.['中文名'], item?.['原名'], ...tags]
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLocaleLowerCase());
}

function filterGalleryRows(rows, state) {
  const expectedStatus = state.status === null ? null : GALLERY_STATUSES[state.status];
  const terms = gallerySearchTerms(state.query);

  return rows.filter((row) => {
    const item = row?.$item ?? {};
    if (expectedStatus !== null && item['状态'] !== expectedStatus) return false;
    if (state.favoriteOnly && item['收藏'] !== true) return false;
    if (state.unknownTotalOnly && !isGalleryTotalUnknown(item)) return false;
    if (terms.length === 0) return true;
    const values = gallerySearchValues(item);
    return terms.every((term) => values.some((value) => value.includes(term)));
  });
}

function galleryDateValue(value) {
  const normalized = textValue(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return null;
  const timestamp = Date.parse(`${normalized}T00:00:00Z`);
  return Number.isFinite(timestamp) && animeCard.formatPremiereMonth(normalized) !== null
    ? timestamp
    : null;
}

function galleryNumberValue(value) {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const normalized = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function compareGalleryTitles(left, right) {
  return animeCard
    .resolveTitle(left?.$item ?? {})
    .localeCompare(animeCard.resolveTitle(right?.$item ?? {}), 'zh-CN', {
      sensitivity: 'base',
      numeric: true,
    });
}

function compareNullableGalleryValues(left, right, direction, compareValues) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const result = compareValues(left, right);
  return direction === 'asc' ? result : -result;
}

function sortGalleryRows(rows, sort) {
  const indexed = rows.map((row, index) => ({ row, index }));
  const statusRank = new Map(GALLERY_DEFAULT_STATUS_ORDER.map((status, index) => [status, index]));

  indexed.sort((leftEntry, rightEntry) => {
    const left = leftEntry.row;
    const right = rightEntry.row;
    let result = 0;

    if (sort === null) {
      const leftRank = statusRank.get(left?.$item?.['状态']) ?? GALLERY_DEFAULT_STATUS_ORDER.length;
      const rightRank = statusRank.get(right?.$item?.['状态']) ?? GALLERY_DEFAULT_STATUS_ORDER.length;
      result = leftRank - rightRank;
      if (result === 0) {
        result = compareNullableGalleryValues(
          galleryDateValue(left?.$item?.['开播日期']),
          galleryDateValue(right?.$item?.['开播日期']),
          'desc',
          (a, b) => a - b,
        );
      }
    } else {
      const definition = GALLERY_SORTS[sort.key];
      if (definition) {
        if (sort.key === 'title') {
          result = sort.direction === 'asc'
            ? compareGalleryTitles(left, right)
            : compareGalleryTitles(right, left);
        } else {
          const valueOf = definition.field === '开播日期' ? galleryDateValue : galleryNumberValue;
          result = compareNullableGalleryValues(
            valueOf(left?.$item?.[definition.field]),
            valueOf(right?.$item?.[definition.field]),
            sort.direction,
            (a, b) => a - b,
          );
        }
      }
    }

    if (result === 0 && sort?.key !== 'title') result = compareGalleryTitles(left, right);
    return result === 0 ? leftEntry.index - rightEntry.index : result;
  });
  return indexed.map((entry) => entry.row);
}

function resolveGallery(rows, state) {
  const filtered = filterGalleryRows(rows, state);
  const sorted = sortGalleryRows(filtered, state.sort);
  return {
    counts: countGalleryRows(rows),
    allResults: sorted,
    visibleRows: sorted.slice(0, state.visibleCount),
  };
}

function nextGalleryVisibleCount(current, total) {
  return Math.min(total, Math.max(GALLERY_BATCH_SIZE, current) + GALLERY_BATCH_SIZE);
}

const animeGallery = Object.freeze({
  batchSize: GALLERY_BATCH_SIZE,
  statuses: GALLERY_STATUSES,
  sorts: GALLERY_SORTS,
  collectRows: collectGalleryRows,
  createState: createGalleryState,
  toggleStatus: toggleGalleryStatus,
  cycleSort: cycleGallerySort,
  clearConditions: clearGalleryConditions,
  isUnknownTotal: isGalleryTotalUnknown,
  countRows: countGalleryRows,
  filterRows: filterGalleryRows,
  sortRows: sortGalleryRows,
  resolve: resolveGallery,
  nextVisibleCount: nextGalleryVisibleCount,
});

function displayValue(value) {
  return value === null ? 'null' : String(value);
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function renderError(container, error) {
  container.replaceChildren();
  const root = document.createElement('div');
  root.className = 'aganAnimeMediaProgress--Root';
  root.dataset.state = 'error';

  const message = document.createElement('span');
  message.className = 'aganAnimeMediaProgress--Message';
  message.textContent = errorMessage(error);
  root.appendChild(message);
  container.appendChild(root);
}

function renderProgress(props, filePath, body, total, token, isCurrent, message = '') {
  if (!isCurrent(token)) return;

  let progress;
  try {
    progress = mediaProgress.read(body, total);
  } catch (error) {
    renderError(props.container, error);
    return;
  }

  const root = document.createElement('div');
  root.className = 'aganAnimeMediaProgress--Root';
  root.dataset.state = 'ready';

  const values = document.createElement('div');
  values.className = 'aganAnimeMediaProgress--Values';
  values.textContent = [
    `current: ${displayValue(progress.current)}`,
    `total: ${displayValue(progress.total)}`,
    `unit: ${progress.unit}`,
    `percentage: ${displayValue(progress.percentage)}`,
    `reachedTotal: ${displayValue(progress.reachedTotal)}`,
  ].join(' · ');

  const controls = document.createElement('div');
  controls.className = 'aganAnimeMediaProgress--Controls';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.step = '1';
  input.inputMode = 'numeric';
  input.setAttribute('aria-label', '新的已观看集数');
  input.value = progress.current === null ? '' : String(progress.current);
  if (progress.total !== null) input.max = String(progress.total);

  const save = document.createElement('button');
  save.type = 'button';
  save.textContent = '保存';

  const status = document.createElement('span');
  status.className = 'aganAnimeMediaProgress--Message';
  status.setAttribute('aria-live', 'polite');
  status.textContent = message;

  save.addEventListener('click', () => {
    void (async () => {
      save.disabled = true;
      status.textContent = '';
      try {
        const nextCurrent = input.value.trim() === '' ? Number.NaN : Number(input.value);
        const latestBody = await props.markdown.read(filePath);
        const nextBody = mediaProgress.updateBody(latestBody, total, nextCurrent);
        await props.markdown.replace(filePath, nextBody);
        const savedBody = await props.markdown.read(filePath);
        if (!isCurrent(token)) return;
        renderProgress(props, filePath, savedBody, total, token, isCurrent, '已保存');
      } catch (error) {
        if (!isCurrent(token)) return;
        save.disabled = false;
        status.textContent = errorMessage(error);
      }
    })();
  });

  controls.append(input, save, status);
  root.append(values, controls);
  props.container.replaceChildren(root);
}

function element(tagName, className, text) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderCardCover(cover, title) {
  const frame = element('div', 'aganAnimeCard--CoverFrame');
  const placeholder = element('div', 'aganAnimeCard--CoverPlaceholder', '暂无封面');
  frame.appendChild(placeholder);

  const source = textValue(cover);
  if (!source) {
    frame.dataset.state = 'empty';
    return frame;
  }

  const image = element('img', 'aganAnimeCard--Cover');
  image.alt = `${title}封面`;
  image.loading = 'lazy';
  image.addEventListener('load', () => {
    frame.dataset.state = 'ready';
  });
  image.addEventListener('error', () => {
    image.remove();
    frame.dataset.state = 'error';
    placeholder.textContent = '封面加载失败';
  });
  image.src = source;
  frame.appendChild(image);
  return frame;
}

function openDescriptionModal(props, item, body, filePath, token, isCurrent, modalControl) {
  if (!props.obsidian?.Modal) return;

  const modal = new props.obsidian.Modal(props.app);
  modal.titleEl.textContent = '简介';
  const presentation = animeCard.descriptionPresentation(item.description);

  if (presentation.mode === 'view') {
    const content = element('div', 'aganAnimeCard--DescriptionText', presentation.value);
    modal.contentEl.appendChild(content);
  } else {
    const input = element('textarea', 'aganAnimeCard--DescriptionInput');
    input.placeholder = '输入简介';
    input.rows = 6;

    const actions = element('div', 'aganAnimeCard--ModalActions');
    const save = element('button', '', '保存');
    save.type = 'button';
    save.classList.add('mod-cta');
    const message = element('span', 'aganAnimeCard--Message');
    message.setAttribute('aria-live', 'polite');

    save.addEventListener('click', () => {
      void (async () => {
        save.disabled = true;
        message.textContent = '';
        try {
          await props.api.updateCell(props.row.id, 'description', input.value);
          if (!isCurrent(token)) return;
          const nextProps = {
            ...props,
            row: { ...props.row, $item: { ...item, description: input.value } },
          };
          modal.close();
          renderAnimeCard(
            nextProps,
            filePath,
            body,
            token,
            isCurrent,
            modalControl,
            '简介已保存',
          );
        } catch (error) {
          if (!isCurrent(token)) return;
          save.disabled = false;
          message.textContent = errorMessage(error);
        }
      })();
    });

    actions.append(save, message);
    modal.contentEl.append(input, actions);
  }

  modal.onClose = () => {
    modal.contentEl.replaceChildren();
    modalControl.closed(modal);
  };
  modalControl.opened(modal);
  modal.open();
}

function renderAnimeCard(
  props,
  filePath,
  body,
  token,
  isCurrent,
  modalControl,
  message = '',
) {
  if (!isCurrent(token)) return;

  const item = props.row.$item;
  const title = animeCard.resolveTitle(item);
  const status = animeCard.statusPresentation(item['状态']);
  const nextStatus = animeCard.nextQuickStatus(item['状态']);
  const rating = animeCard.ratingPresentation(item['个人评分']);
  const month = animeCard.formatPremiereMonth(item['开播日期']);
  const tags = animeCard.firstTags(item.tags);

  let progress = null;
  let progressError = null;
  if (body !== null) {
    try {
      progress = mediaProgress.read(body, item['总集数']);
    } catch (error) {
      progressError = error;
    }
  }

  const root = element('article', 'aganAnimeCard--Root');
  root.dataset.status = status.key;

  const coverArea = element('section', 'aganAnimeCard--CoverArea');
  coverArea.appendChild(renderCardCover(item.cover, title));

  const noteLink = props.api.getRowLink?.(props.row.id) ?? null;
  if (noteLink !== null) {
    coverArea.title = `打开《${title}》笔记`;
    coverArea.addEventListener('click', (event) => {
      const target = event.target;
      if (
        target !== null &&
        typeof target.closest === 'function' &&
        target.closest('button') !== null
      ) {
        return;
      }
      void props.app.workspace.openLinkText(noteLink.href, '', event.ctrlKey || event.metaKey);
    });
  }

  const typeBadge = element('span', 'aganAnimeCard--Badge aganAnimeCard--TypeBadge');
  typeBadge.textContent = textValue(item['改编类型']) ?? '—';
  typeBadge.dataset.empty = String(textValue(item['改编类型']) === null);

  const statusBadge = element(
    nextStatus === null ? 'span' : 'button',
    'aganAnimeCard--Badge aganAnimeCard--StatusBadge',
    status.label,
  );
  if (nextStatus !== null) {
    statusBadge.type = 'button';
    statusBadge.title = `切换为${animeCard.statusPresentation(nextStatus).label}`;
    statusBadge.addEventListener('click', () => {
      void (async () => {
        statusBadge.disabled = true;
        try {
          await props.api.updateCell(props.row.id, '状态', nextStatus);
          if (!isCurrent(token)) return;
          const nextProps = {
            ...props,
            row: { ...props.row, $item: { ...item, 状态: nextStatus } },
          };
          renderAnimeCard(
            nextProps,
            filePath,
            body,
            token,
            isCurrent,
            modalControl,
            '状态已更新',
          );
        } catch (error) {
          if (!isCurrent(token)) return;
          statusBadge.disabled = false;
          actionMessage.textContent = errorMessage(error);
        }
      })();
    });
  }

  const coverTop = element('div', 'aganAnimeCard--CoverTop');
  coverTop.append(typeBadge, statusBadge);

  const coverBottom = element('div', 'aganAnimeCard--CoverBottom');
  const dateBadge = element('span', 'aganAnimeCard--MetaBadge', month ?? '—');
  dateBadge.dataset.empty = String(month === null);
  const ratingBadge = element('span', 'aganAnimeCard--MetaBadge aganAnimeCard--Rating');
  ratingBadge.textContent = rating.hasValue ? `★ ${rating.label}` : '';
  ratingBadge.dataset.empty = String(!rating.hasValue);
  coverBottom.append(dateBadge, ratingBadge);
  coverArea.append(coverTop, coverBottom);

  const bodyArea = element('section', 'aganAnimeCard--Body');
  const titleButton = element(
    'button',
    'aganAnimeCard--Title',
    `${item['收藏'] === true ? '★ ' : ''}${title}`,
  );
  titleButton.type = 'button';
  titleButton.setAttribute('aria-pressed', String(item['收藏'] === true));
  titleButton.title = item['收藏'] === true ? '取消收藏' : '收藏';
  titleButton.addEventListener('click', () => {
    void (async () => {
      titleButton.disabled = true;
      const nextFavorite = item['收藏'] !== true;
      try {
        await props.api.updateCell(props.row.id, '收藏', nextFavorite);
        if (!isCurrent(token)) return;
        const nextProps = {
          ...props,
          row: { ...props.row, $item: { ...item, 收藏: nextFavorite } },
        };
        renderAnimeCard(
          nextProps,
          filePath,
          body,
          token,
          isCurrent,
          modalControl,
          nextFavorite ? '已收藏' : '已取消收藏',
        );
      } catch (error) {
        if (!isCurrent(token)) return;
        titleButton.disabled = false;
        actionMessage.textContent = errorMessage(error);
      }
    })();
  });
  bodyArea.appendChild(titleButton);

  if (tags.length > 0) {
    const tagRow = element('div', 'aganAnimeCard--Tags');
    for (const tag of tags) {
      const tagChip = element('span', 'aganAnimeCard--Tag', tag);
      tagChip.dataset.color = tagColorKey(tag);
      tagRow.appendChild(tagChip);
    }
    bodyArea.appendChild(tagRow);
  }

  const progressArea = element('div', 'aganAnimeCard--ProgressArea');
  if (body === null) {
    progressArea.dataset.state = 'loading';
    progressArea.appendChild(element('span', 'aganAnimeCard--Message', '读取进度…'));
  } else if (progressError !== null) {
    progressArea.dataset.state = 'error';
    progressArea.appendChild(
      element('span', 'aganAnimeCard--Message', `进度不可用：${errorMessage(progressError)}`),
    );
  } else {
    const presentation = animeCard.progressPresentation(progress, item['状态']);
    const barRow = element('div', 'aganAnimeCard--ProgressRow');
    const track = element('div', 'aganAnimeCard--ProgressTrack');
    track.dataset.indeterminate = String(presentation.fillPercentage === null);
    const fill = element('div', 'aganAnimeCard--ProgressFill');
    if (presentation.fillPercentage !== null) {
      fill.style.width = `${presentation.fillPercentage}%`;
    }
    track.appendChild(fill);
    const percentage = element(
      'span',
      'aganAnimeCard--Percentage',
      presentation.percentageLabel ?? '',
    );
    barRow.append(track, percentage);

    const episodeRow = element('div', 'aganAnimeCard--EpisodeRow');
    const readout = element(
      'span',
      'aganAnimeCard--Readout',
      `${presentation.currentLabel} / ${presentation.totalLabel}`,
    );

    const manualInput = element('input', 'aganAnimeCard--ManualInput');
    manualInput.type = 'number';
    manualInput.min = '0';
    manualInput.step = '1';
    manualInput.inputMode = 'numeric';
    manualInput.setAttribute('aria-label', '已观看集数');
    manualInput.title = '直接修改已观看集数';
    manualInput.value = progress.current === null ? '' : String(progress.current);
    if (progress.total !== null) manualInput.max = String(progress.total);

    const controls = element('div', 'aganAnimeCard--StepControls');
    if (presentation.showStepControls) {
      const decrement = element('button', '', '−');
      decrement.type = 'button';
      decrement.title = '减少一集';
      decrement.disabled = !presentation.canDecrement;
      const increment = element('button', '', '+');
      increment.type = 'button';
      increment.title = '增加一集';
      increment.disabled = !presentation.canIncrement;
      controls.append(decrement, manualInput, increment);

      const editControls = [decrement, manualInput, increment];
      decrement.addEventListener('click', () => {
        void commitCardProgress(progress.current - 1, editControls);
      });
      increment.addEventListener('click', () => {
        void commitCardProgress(progress.current + 1, editControls);
      });
      manualInput.addEventListener('change', () => {
        const raw = manualInput.value.trim();
        void commitCardProgress(raw === '' ? Number.NaN : Number(raw), editControls);
      });
    }

    const progressMessage = element('span', 'aganAnimeCard--Message');
    progressMessage.setAttribute('aria-live', 'polite');

    async function commitCardProgress(nextCurrent, buttons) {
      const previousDisabled = buttons.map((button) => button.disabled);
      for (const button of buttons) button.disabled = true;
      progressMessage.textContent = '';
      try {
        const latestBody = await props.markdown.read(filePath);
        mediaProgress.read(latestBody, item['总集数']);
        const nextBody = mediaProgress.updateBody(latestBody, item['总集数'], nextCurrent);
        await props.markdown.replace(filePath, nextBody);
        const savedBody = await props.markdown.read(filePath);
        mediaProgress.read(savedBody, item['总集数']);
        if (!isCurrent(token)) return;
        renderAnimeCard(
          props,
          filePath,
          savedBody,
          token,
          isCurrent,
          modalControl,
          '进度已保存',
        );
      } catch (error) {
        if (!isCurrent(token)) return;
        buttons.forEach((button, index) => {
          button.disabled = previousDisabled[index];
        });
        manualInput.disabled = false;
        progressMessage.textContent = errorMessage(error);
      }
    }

    episodeRow.append(readout, controls);
    progressArea.append(barRow, episodeRow, progressMessage);
  }
  bodyArea.appendChild(progressArea);

  const actionMessage = element('div', 'aganAnimeCard--Message', message);
  actionMessage.setAttribute('aria-live', 'polite');
  bodyArea.appendChild(actionMessage);

  root.append(coverArea, bodyArea);
  props.container.replaceChildren(root);
}

function createAnimeCardInstance() {
  let generation = 0;
  let destroyed = false;
  let activeModal = null;
  let hostContainer = null;
  const isCurrent = (token) => !destroyed && token === generation;
  const modalControl = {
    opened(modal) {
      if (activeModal && activeModal !== modal) activeModal.close();
      activeModal = modal;
    },
    closed(modal) {
      if (activeModal === modal) activeModal = null;
    },
    close() {
      const modal = activeModal;
      activeModal = null;
      modal?.close();
    },
  };

  return {
    onUpdate(props) {
      const token = ++generation;
      modalControl.close();
      if (hostContainer && hostContainer !== props.container) {
        hostContainer.classList.remove('aganAnimeCard--Host');
      }
      hostContainer = props.container;
      hostContainer.classList.add('aganAnimeCard--Host');
      props.container.replaceChildren();

      const link = props.api.getRowLink(props.row.id);
      renderAnimeCard(props, link?.href ?? null, null, token, isCurrent, modalControl);
      if (!link) {
        renderAnimeCard(
          props,
          null,
          '',
          token,
          isCurrent,
          modalControl,
          '无法定位当前动画笔记',
        );
        return;
      }

      void props.markdown
        .read(link.href)
        .then((body) => {
          renderAnimeCard(props, link.href, body, token, isCurrent, modalControl);
        })
        .catch((error) => {
          if (!isCurrent(token)) return;
          renderAnimeCard(
            props,
            link.href,
            '',
            token,
            isCurrent,
            modalControl,
            `进度读取失败：${errorMessage(error)}`,
          );
        });
    },

    onDestroy() {
      destroyed = true;
      generation += 1;
      modalControl.close();
      hostContainer?.classList.remove('aganAnimeCard--Host');
      hostContainer = null;
    },
  };
}

function createAnimeGalleryInstance() {
  let destroyed = false;
  let latestProps = null;
  let state = animeGallery.createState();
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
    const button = element('button', 'aganAnimeGallery--FilterButton', label);
    button.type = 'button';
    button.addEventListener('click', onClick);
    return button;
  }

  function ensureDom(props) {
    if (root !== null) return;

    root = element('section', 'aganAnimeGallery--Root');
    const heading = element('h2', 'aganAnimeGallery--Heading', '追番画廊');
    const filters = element('div', 'aganAnimeGallery--Filters');
    const statusGroup = element('div', 'aganAnimeGallery--FilterGroup');
    const allButton = createToggleButton('全部', () => {
      resetAndRender({ ...state, status: null });
    });
    statusButtons.set('all', allButton);
    statusGroup.appendChild(allButton);
    for (const [key, label] of [
      ['watching', '在看'],
      ['planned', '想看'],
      ['completed', '已看'],
      ['paused', '暂缓'],
    ]) {
      const button = createToggleButton(label, () => {
        resetAndRender(animeGallery.toggleStatus(state, key));
      });
      statusButtons.set(key, button);
      statusGroup.appendChild(button);
    }

    const additionalGroup = element('div', 'aganAnimeGallery--FilterGroup');
    const favoriteButton = createToggleButton('★ 收藏', () => {
      resetAndRender({ ...state, favoriteOnly: !state.favoriteOnly });
    });
    const unknownButton = createToggleButton('集数未知', () => {
      resetAndRender({ ...state, unknownTotalOnly: !state.unknownTotalOnly });
    });
    additionalButtons.set('favorite', favoriteButton);
    additionalButtons.set('unknownTotal', unknownButton);
    additionalGroup.append(favoriteButton, unknownButton);
    filters.append(statusGroup, additionalGroup);

    const tools = element('div', 'aganAnimeGallery--Tools');
    searchInput = element('input', 'aganAnimeGallery--Search');
    searchInput.type = 'search';
    searchInput.placeholder = '搜索中文名、原名或标签';
    searchInput.setAttribute('aria-label', '搜索动画');
    searchInput.addEventListener('input', () => {
      resetAndRender({ ...state, query: searchInput.value });
    });
    const sortGroup = element('div', 'aganAnimeGallery--SortGroup');
    for (const [key, label] of [
      ['premiere', '开播日期'],
      ['personalRating', '个人评分'],
      ['title', '标题'],
    ]) {
      const button = element('button', 'aganAnimeGallery--SortButton', label);
      button.type = 'button';
      button.addEventListener('click', () => {
        resetAndRender({ ...state, sort: animeGallery.cycleSort(state.sort, key) });
      });
      sortButtons.set(key, { button, label });
      sortGroup.appendChild(button);
    }
    tools.append(searchInput, sortGroup);

    resultsArea = element('div', 'aganAnimeGallery--Results');
    grid = element('div', 'aganAnimeGallery--Grid');
    emptyState = element('div', 'aganAnimeGallery--Empty');
    sentinel = element('div', 'aganAnimeGallery--Sentinel');
    sentinel.setAttribute('aria-hidden', 'true');
    resultsArea.append(grid, emptyState);
    root.append(heading, filters, tools, resultsArea);
    props.container.replaceChildren(root);

    if (typeof IntersectionObserver === 'function') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          if (destroyed || !entries.some((entry) => entry.isIntersecting)) return;
          const nextCount = animeGallery.nextVisibleCount(state.visibleCount, currentResults.length);
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

        root.style.setProperty('--agan-gallery-card-min-w', `${GALLERY_CARD_MIN_WIDTH}px`);
        root.style.setProperty('--agan-gallery-card-w', `${cardWidth}px`);
        root.style.setProperty(
          '--agan-gallery-cover-h',
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
      watching: '在看',
      planned: '想看',
      completed: '已看',
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
    const unknownButton = additionalButtons.get('unknownTotal');
    unknownButton.textContent = `集数未知 ${counts.unknownTotal}`;
    unknownButton.setAttribute('aria-pressed', String(state.unknownTotalOnly));
    if (searchInput.value !== state.query) searchInput.value = state.query;

    for (const [key, entry] of sortButtons) {
      const active = state.sort?.key === key;
      const arrow = active ? (state.sort.direction === 'asc' ? ' ↑' : ' ↓') : '';
      entry.button.textContent = `${entry.label}${arrow}`;
      entry.button.setAttribute('aria-pressed', String(active));
    }
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

  function getOrCreateCard(rowId) {
    let card = cards.get(rowId);
    if (card) return card;
    const slot = element('div', 'aganAnimeGallery--CardSlot');
    const canvas = element('div', 'aganAnimeGallery--CardCanvas');
    slot.appendChild(canvas);
    card = { slot, canvas, instance: createAnimeCardInstance() };
    cards.set(rowId, card);
    return card;
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
    const rows = animeGallery.collectRows(latestProps.viewData?.groups);
    const resolved = animeGallery.resolve(rows, state);
    currentResults = resolved.allResults;
    updateControls(resolved.counts);

    intersectionObserver?.disconnect();
    if (rows.length === 0) {
      for (const rowId of Array.from(cards.keys())) destroyCard(rowId);
      grid.replaceChildren();
      emptyState.replaceChildren(
        element('strong', 'aganAnimeGallery--EmptyTitle', '暂无动画'),
        element('span', '', '当前动画库没有可展示记录'),
      );
      emptyState.hidden = false;
    } else if (resolved.allResults.length === 0) {
      for (const rowId of Array.from(cards.keys())) destroyCard(rowId);
      grid.replaceChildren();
      const clear = element('button', '', '清除条件');
      clear.type = 'button';
      clear.addEventListener('click', () => {
        resetAndRender(animeGallery.clearConditions(state));
      });
      emptyState.replaceChildren(
        element('strong', 'aganAnimeGallery--EmptyTitle', '没有找到匹配的动画'),
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
      for (const rowId of Array.from(cards.keys())) destroyCard(rowId);
      latestProps?.container?.replaceChildren();
      latestProps = null;
      currentResults = [];
      root = null;
    },
  };
}

module.exports = {
  id: PLUGIN_ID,
  name: '媒体库-动画卡片',
  description: '读取并安全修改动画正文中的已观看集数，展示动画卡片与追番画廊。',
  author: 'agan',
  version: '1.0.0',
  mediaProgress,
  MediaProgressError,
  animeCard,
  animeGallery,

  install(ctx) {
    const registered = ctx.registerFieldType({
      type: FIELD_TYPE,
      label: '动画 Media Progress',
      icon: 'activity',
      order: 100,
      match: ({ api }) => api.getDefinition().source === 'file',
    });
    if (!registered) throw new Error(`Failed to register ${FIELD_TYPE}`);

    const cardRegistered = ctx.registerFieldType({
      type: CARD_FIELD_TYPE,
      label: '动画卡片',
      icon: 'panelTop',
      order: 101,
      match: ({ api }) => api.getDefinition().source === 'file',
    });
    if (!cardRegistered) throw new Error(`Failed to register ${CARD_FIELD_TYPE}`);

    ctx.registerFieldRenderer({
      id: RENDERER_ID,
      name: '动画 Media Progress Renderer',
      description: '从动画笔记正文读取并修改已观看集数。',
      icon: 'activity',
      order: -100,
      match: ({ field }) => field.type === FIELD_TYPE,
      isValueEmpty: () => false,
      view() {
        let generation = 0;
        let destroyed = false;
        const isCurrent = (token) => !destroyed && token === generation;

        return {
          onUpdate(props) {
            const token = ++generation;
            props.container.replaceChildren();

            const loading = document.createElement('div');
            loading.className = 'aganAnimeMediaProgress--Root';
            loading.dataset.state = 'loading';
            loading.textContent = '读取进度…';
            props.container.appendChild(loading);

            const link = props.api.getRowLink(props.row.id);
            if (!link) {
              renderError(props.container, new Error('无法定位当前动画笔记'));
              return;
            }

            void props.markdown
              .read(link.href)
              .then((body) => {
                renderProgress(
                  props,
                  link.href,
                  body,
                  props.row.$item['总集数'],
                  token,
                  isCurrent,
                );
              })
              .catch((error) => {
                if (isCurrent(token)) renderError(props.container, error);
              });
          },

          onDestroy() {
            destroyed = true;
            generation += 1;
          },
        };
      },
    });

    ctx.registerFieldRenderer({
      id: CARD_RENDERER_ID,
      name: '动画卡片 Renderer',
      description: '展示并操作单张动画卡片。',
      icon: 'panelTop',
      order: -99,
      match: ({ field }) => field.type === CARD_FIELD_TYPE,
      isValueEmpty: () => false,
      view: createAnimeCardInstance,
    });

    ctx.registerDatabaseView({
      id: GALLERY_VIEW_TYPE,
      name: '追番画廊',
      icon: 'layoutGrid',
      description: '筛选、搜索、排序并渐进展示动画卡片。',
      view: createAnimeGalleryInstance,
    });

    ctx.registerStyleSheet(`
      .aganAnimeMediaProgress--Root {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-1);
        min-width: 18rem;
        white-space: normal;
        color: var(--text-normal);
        font-size: var(--font-ui-smaller);
      }

      .aganAnimeMediaProgress--Values {
        overflow-wrap: anywhere;
      }

      .aganAnimeMediaProgress--Controls {
        display: flex;
        align-items: center;
        gap: var(--size-2-1);
      }

      .aganAnimeMediaProgress--Controls input {
        width: 5.5rem;
      }

      .aganAnimeMediaProgress--Message {
        color: var(--text-muted);
      }

      .aganAnimeMediaProgress--Root[data-state="error"] .aganAnimeMediaProgress--Message {
        color: var(--text-error);
      }

      .aganAnimeCard--Root {
        width: 18rem;
        overflow: hidden;
        border: 1px solid var(--background-modifier-border);
        border-radius: 16px;
        background: var(--background-primary-alt);
        color: var(--text-normal);
        white-space: normal;
        box-shadow: var(--shadow-s);
      }

      .aganAnimeCard--Host {
        overflow: visible;
        text-overflow: clip;
        white-space: normal;
      }

      .aganAnimeCard--CoverArea {
        position: relative;
        aspect-ratio: 2 / 3;
        overflow: hidden;
        background: var(--background-secondary);
        cursor: pointer;
      }

      .aganAnimeCard--CoverArea::after {
        content: "";
        position: absolute;
        right: 0;
        bottom: 0;
        left: 0;
        height: 42%;
        pointer-events: none;
        background: linear-gradient(transparent, rgb(0 0 0 / 0.42));
      }

      .aganAnimeCard--CoverFrame,
      .aganAnimeCard--Cover,
      .aganAnimeCard--CoverPlaceholder {
        width: 100%;
        height: 100%;
      }

      .aganAnimeCard--CoverFrame {
        position: relative;
      }

      .aganAnimeCard--Cover,
      .aganAnimeCard--CoverPlaceholder {
        position: absolute;
        inset: 0;
      }

      .aganAnimeCard--Cover {
        display: block;
        object-fit: cover;
      }

      .aganAnimeCard--CoverPlaceholder {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        background: var(--background-secondary);
      }

      .aganAnimeCard--CoverFrame[data-state="ready"] .aganAnimeCard--CoverPlaceholder {
        display: none;
      }

      .aganAnimeCard--CoverTop,
      .aganAnimeCard--CoverBottom {
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

      .aganAnimeCard--CoverTop {
        top: var(--size-4-3);
      }

      .aganAnimeCard--CoverBottom {
        bottom: var(--size-4-3);
      }

      .aganAnimeCard--Badge,
      .aganAnimeCard--MetaBadge {
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

      button.aganAnimeCard--StatusBadge {
        cursor: pointer;
      }

      button.aganAnimeCard--StatusBadge:hover {
        background: #fff;
      }

      .aganAnimeCard--Root[data-status="paused"] .aganAnimeCard--StatusBadge {
        color: #374151;
        background: #e5e7eb;
        border-color: #6b7280;
      }

      .aganAnimeCard--Root[data-status="planned"] .aganAnimeCard--StatusBadge {
        color: #713f12;
        background: #fef9c3;
        border-color: #eab308;
      }

      .aganAnimeCard--Root[data-status="watching"] .aganAnimeCard--StatusBadge {
        color: #14532d;
        background: #dcfce7;
        border-color: #22c55e;
      }

      .aganAnimeCard--Root[data-status="completed"] .aganAnimeCard--StatusBadge {
        color: #1e3a8a;
        background: #dbeafe;
        border-color: #3b82f6;
      }

      .aganAnimeCard--Badge[data-empty="true"],
      .aganAnimeCard--MetaBadge[data-empty="true"] {
        color: rgb(255 255 255 / 0.95);
        background: rgb(255 255 255 / 0.42);
      }

      .aganAnimeCard--Rating {
        min-width: 3.25rem;
        text-align: center;
      }

      .aganAnimeCard--Rating[data-empty="true"] {
        display: none;
      }

      .aganAnimeCard--Body {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-3);
        padding: var(--size-4-3);
      }

      button.aganAnimeCard--Title,
      button.aganAnimeCard--Description {
        height: auto;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        color: inherit;
      }

      button.aganAnimeCard--Title {
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

      .aganAnimeCard--Tags {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        gap: 4px;
        height: calc(2 * (1.4em + 4px) + 4px);
        overflow: hidden;
        font-size: 11px;
        line-height: 1.4;
      }

      .aganAnimeCard--Tag {
        flex: 0 0 auto;
        padding: 1px 7px;
        border: 1px solid transparent;
        border-radius: 5px;
        background: var(--background-secondary);
        color: var(--text-muted);
        letter-spacing: 0.01em;
        white-space: nowrap;
      }

      .aganAnimeCard--Tag[data-color="t0"] {
        background: #fde2e4;
        color: #9d2449;
      }

      .aganAnimeCard--Tag[data-color="t1"] {
        background: #ffe4e6;
        color: #9f1239;
      }

      .aganAnimeCard--Tag[data-color="t2"] {
        background: #ffedd5;
        color: #9a3412;
      }

      .aganAnimeCard--Tag[data-color="t3"] {
        background: #d1fae5;
        color: #065f46;
      }

      .aganAnimeCard--Tag[data-color="t4"] {
        background: #fee2e2;
        color: #991b1b;
      }

      .aganAnimeCard--Tag[data-color="t5"] {
        background: #ede9fe;
        color: #5b21b6;
      }

      .aganAnimeCard--Tag[data-color="t6"] {
        background: #cffafe;
        color: #155e75;
      }

      .aganAnimeCard--Tag[data-color="t7"] {
        background: #f3e8ff;
        color: #6b21a8;
      }

      .aganAnimeCard--Tag[data-color="t8"] {
        background: #dbeafe;
        color: #1e40af;
      }

      .aganAnimeCard--Tag[data-color="t9"] {
        background: #fce7f3;
        color: #9d174d;
      }

      .aganAnimeCard--Tag[data-color="t10"] {
        background: #dcfce7;
        color: #166534;
      }

      .aganAnimeCard--Tag[data-color="t11"] {
        background: #fef3c7;
        color: #92400e;
      }

      .aganAnimeCard--ProgressArea {
        display: flex;
        flex-direction: column;
        gap: var(--size-2-2);
      }

      .aganAnimeCard--ProgressArea[data-state="error"] .aganAnimeCard--Message {
        color: var(--text-error);
      }

      .aganAnimeCard--ProgressRow,
      .aganAnimeCard--EpisodeRow,
      .aganAnimeCard--Readout,
      .aganAnimeCard--StepControls,
      .aganAnimeCard--ModalActions {
        display: flex;
        align-items: center;
        gap: var(--size-2-2);
      }

      .aganAnimeCard--ProgressTrack {
        position: relative;
        flex: 1;
        height: 8px;
        overflow: hidden;
        border-radius: 999px;
        background: var(--background-modifier-border);
      }

      .aganAnimeCard--ProgressTrack[data-indeterminate="true"] {
        background: repeating-linear-gradient(
          135deg,
          var(--background-modifier-border),
          var(--background-modifier-border) 0.35rem,
          var(--background-secondary) 0.35rem,
          var(--background-secondary) 0.7rem
        );
      }

      .aganAnimeCard--ProgressFill {
        height: 100%;
        border-radius: inherit;
        background: var(--interactive-accent);
      }

      .aganAnimeCard--Percentage {
        min-width: 2.6rem;
        color: var(--text-muted);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
        text-align: right;
      }

      .aganAnimeCard--EpisodeRow {
        justify-content: space-between;
        min-height: 1.75rem;
      }

      .aganAnimeCard--Readout {
        font-size: var(--font-ui-small);
        font-variant-numeric: tabular-nums;
        color: var(--text-muted);
      }

      .aganAnimeCard--Message {
        color: var(--text-muted);
        font-size: var(--font-ui-smaller);
      }

      .aganAnimeCard--StepControls {
        flex: 0 0 auto;
      }

      .aganAnimeCard--StepControls button {
        min-width: 1.75rem;
        height: 1.75rem;
        padding: 0 6px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-secondary);
        color: var(--text-muted);
        cursor: pointer;
      }

      .aganAnimeCard--StepControls button:hover {
        background: var(--background-secondary-alt);
        color: var(--text-normal);
      }

      .aganAnimeCard--ManualInput {
        box-sizing: border-box;
        width: 3.2rem;
        height: 1.75rem;
        padding: 0;
        text-align: center;
        font-variant-numeric: tabular-nums;
      }

      .aganAnimeCard--DescriptionText {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .aganAnimeCard--DescriptionInput {
        width: 100%;
        resize: vertical;
      }

      .aganAnimeCard--ModalActions {
        margin-top: var(--size-4-3);
      }

      .aganAnimeGallery--Root {
        --agan-gallery-card-min-w: 210px;
        /* 卡片宽度由 ResizeObserver 按可视宽度写回；这里仅供首帧使用。 */
        /* 列数由 GALLERY_CARD_MIN_WIDTH 决定。 */
        --agan-gallery-card-w: 210px;
        --agan-gallery-cover-h: 255px;
        --agan-gallery-slot-width: var(--agan-gallery-card-w);
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        overflow-x: clip;
        padding: 18px clamp(12px, 2%, 28px) 32px;
        color: var(--text-normal);
      }

      .aganAnimeGallery--Heading {
        margin: 0 0 12px;
        font-size: 22px;
        font-weight: 700;
        line-height: 1.3;
      }

      .aganAnimeGallery--Filters,
      .aganAnimeGallery--FilterGroup,
      .aganAnimeGallery--Tools,
      .aganAnimeGallery--SortGroup {
        display: flex;
        align-items: center;
        gap: var(--size-2-2);
      }

      .aganAnimeGallery--Filters,
      .aganAnimeGallery--Tools,
      .aganAnimeGallery--SortGroup {
        flex-wrap: wrap;
      }

      .aganAnimeGallery--Filters {
        justify-content: space-between;
        margin-bottom: var(--size-4-3);
      }

      .aganAnimeGallery--FilterGroup {
        flex-wrap: wrap;
      }

      .aganAnimeGallery--Tools {
        margin-bottom: 12px;
      }

      .aganAnimeGallery--Search {
        flex: 1 1 18rem;
        min-width: min(18rem, 100%);
        max-width: 22rem;
      }

      .aganAnimeGallery--FilterButton,
      .aganAnimeGallery--SortButton {
        margin-right: 4px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: transparent;
        color: var(--text-muted);
        font-size: 15px;
      }

      .aganAnimeGallery--FilterButton[aria-pressed="true"],
      .aganAnimeGallery--SortButton[aria-pressed="true"] {
        border-color: transparent;
        color: var(--text-on-accent);
        background: var(--interactive-accent);
      }

      .aganAnimeGallery--Results {
        width: 100%;
        min-width: 0;
        overflow-x: clip;
      }

      .aganAnimeGallery--Grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fill,
          minmax(min(var(--agan-gallery-card-min-w), 100%), 1fr)
        );
        justify-content: start;
        align-items: start;
        gap: 12px;
        width: 100%;
      }

      .aganAnimeGallery--CardSlot {
        position: relative;
        width: 100%;
        min-width: 0;
        height: auto;
        overflow: visible;
        transition: transform 160ms ease;
      }

      @media (hover: hover) {
        .aganAnimeGallery--CardSlot:hover {
          z-index: 1;
          transform: translateY(-2px);
        }
      }

      .aganAnimeGallery--CardSlot:focus-within {
        z-index: 1;
        transform: translateY(-2px);
      }

      @media (prefers-reduced-motion: reduce) {
        .aganAnimeGallery--CardSlot {
          transition: none;
        }

        .aganAnimeGallery--CardSlot:hover,
        .aganAnimeGallery--CardSlot:focus-within {
          transform: none;
        }
      }

      .aganAnimeGallery--CardCanvas {
        width: 100%;
        min-width: 0;
        height: auto;
      }

      .aganAnimeGallery--CardCanvas .aganAnimeCard--Root {
        display: grid;
        grid-template-rows: var(--agan-gallery-cover-h) auto;
        box-sizing: border-box;
        width: 100%;
        max-width: 100%;
        height: auto;
      }

      .aganAnimeGallery--CardCanvas .aganAnimeCard--CoverArea {
        height: var(--agan-gallery-cover-h);
        aspect-ratio: auto;
      }

      .aganAnimeGallery--CardCanvas .aganAnimeCard--Body {
        min-height: 0;
        overflow: hidden;
      }

      .aganAnimeGallery--Sentinel {
        grid-column: 1 / -1;
        width: 100%;
        height: 1px;
      }

      .aganAnimeGallery--Empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--size-2-3);
        padding: var(--size-4-6) 0;
        color: var(--text-muted);
      }

      .aganAnimeGallery--Empty[hidden] {
        display: none;
      }

      .aganAnimeGallery--EmptyTitle {
        color: var(--text-normal);
        font-size: var(--font-ui-medium);
      }

      @media (max-width: 540px) {
        .aganAnimeGallery--Tools {
          align-items: stretch;
        }

        .aganAnimeGallery--Search,
        .aganAnimeGallery--SortGroup {
          flex-basis: 100%;
        }
      }

      .theme-light .aganAnimeGallery--Root {
        color: var(--text-normal);
        background: transparent;
      }

      .theme-light .aganAnimeGallery--Heading {
        margin-bottom: 14px;
        padding: 14px 18px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 14px;
        background: color-mix(in srgb, var(--background-secondary) 82%, transparent);
        color: var(--text-normal);
        font-size: 20px;
      }

      .theme-light .aganAnimeGallery--Heading::before {
        content: "⚑";
        margin-right: 8px;
        color: var(--color-red);
      }

      .theme-light .aganAnimeGallery--Filters {
        gap: 8px 16px;
        margin-bottom: 12px;
        padding: 2px 0 0;
        border: 0;
        background: transparent;
      }

      .theme-light .aganAnimeGallery--FilterGroup,
      .theme-light .aganAnimeGallery--SortGroup {
        gap: 6px;
      }

      .theme-light .aganAnimeGallery--Tools {
        gap: 9px 14px;
        margin-bottom: 14px;
      }

      .theme-light .aganAnimeGallery--Search {
        min-height: 32px;
        padding: 5px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 999px;
        background: var(--background-primary);
        box-shadow: none;
        color: var(--text-normal);
      }

      .theme-light .aganAnimeGallery--Search::placeholder {
        color: var(--text-faint);
      }

      .theme-light .aganAnimeGallery--Search:focus {
        border-color: var(--interactive-accent);
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 16%, transparent);
      }

      .theme-light .aganAnimeGallery--FilterButton,
      .theme-light .aganAnimeGallery--SortButton {
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

      .theme-light .aganAnimeGallery--FilterButton:hover,
      .theme-light .aganAnimeGallery--SortButton:hover {
        border-color: var(--interactive-accent);
        background: color-mix(in srgb, var(--interactive-accent) 8%, var(--background-primary));
        color: var(--text-normal);
      }

      .theme-light .aganAnimeGallery--FilterButton[aria-pressed="true"],
      .theme-light .aganAnimeGallery--SortButton[aria-pressed="true"] {
        border-color: var(--interactive-accent);
        background: color-mix(in srgb, var(--interactive-accent) 14%, var(--background-primary));
        color: var(--text-normal);
        box-shadow: none;
      }

      .theme-light .aganAnimeCard--Root {
        border-color: var(--background-modifier-border);
        background: var(--background-secondary);
        box-shadow: 0 2px 8px rgb(0 0 0 / 0.05);
        color: var(--text-normal);
        transition: border-color 160ms ease, box-shadow 160ms ease;
      }

      .theme-light .aganAnimeCard--Root:hover {
        border-color: var(--interactive-accent);
        box-shadow: 0 7px 18px rgb(0 0 0 / 0.1);
      }

      .theme-light .aganAnimeCard--CoverArea {
        background: var(--background-secondary);
      }

      .theme-light .aganAnimeCard--CoverArea::after {
        height: 35%;
        background: linear-gradient(transparent, rgb(24 20 30 / 0.54));
      }

      .theme-light .aganAnimeCard--CoverPlaceholder {
        background: var(--background-secondary-alt);
        color: var(--text-muted);
      }

      .theme-light .aganAnimeCard--Badge,
      .theme-light .aganAnimeCard--MetaBadge {
        border-radius: 999px;
        box-shadow: 0 2px 5px rgb(22 18 28 / 0.2);
        font-weight: 600;
      }

      .theme-light .aganAnimeCard--TypeBadge,
      .theme-light .aganAnimeCard--MetaBadge {
        border-color: rgb(255 255 255 / 0.18);
        background: rgb(42 36 50 / 0.76);
        color: #fff;
      }

      .theme-light .aganAnimeCard--Rating {
        border-color: rgb(250 214 127 / 0.3);
        background: rgb(51 42 40 / 0.86);
        color: #f9dc80;
      }

      .theme-light .aganAnimeCard--Root[data-status="paused"] {
        --agan-card-progress-color: var(--text-muted);
      }

      .theme-light .aganAnimeCard--Root[data-status="planned"] {
        --agan-card-progress-color: var(--color-yellow);
      }

      .theme-light .aganAnimeCard--Root[data-status="watching"] {
        --agan-card-progress-color: var(--color-green);
      }

      .theme-light .aganAnimeCard--Root[data-status="completed"] {
        --agan-card-progress-color: var(--color-blue);
      }

      .theme-light .aganAnimeCard--StatusBadge {
        border-width: 1px;
        box-shadow: 0 2px 5px rgb(22 18 28 / 0.16);
      }

      .theme-light button.aganAnimeCard--StatusBadge:hover {
        filter: brightness(1.06);
      }

      .theme-light .aganAnimeCard--Body {
        background: var(--background-secondary);
      }

      .theme-light button.aganAnimeCard--Title {
        color: var(--text-normal);
      }

      .theme-light button.aganAnimeCard--Title:hover {
        color: var(--interactive-accent);
      }

      .theme-light .aganAnimeCard--Tag {
        border-color: var(--background-modifier-border);
        border-radius: 999px;
      }

      .theme-light .aganAnimeCard--ProgressTrack {
        height: 6px;
        background: var(--background-modifier-border);
      }

      .theme-light .aganAnimeCard--ProgressTrack[data-indeterminate="true"] {
        background: repeating-linear-gradient(
          135deg,
          var(--background-modifier-border),
          var(--background-modifier-border) 0.35rem,
          var(--background-secondary-alt) 0.35rem,
          var(--background-secondary-alt) 0.7rem
        );
      }

      .theme-light .aganAnimeCard--ProgressFill {
        background: var(--agan-card-progress-color, var(--interactive-accent));
      }

      .theme-light .aganAnimeCard--Percentage,
      .theme-light .aganAnimeCard--Readout {
        color: var(--text-muted);
      }

      .theme-light .aganAnimeCard--StepControls button {
        border-color: var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
        color: var(--text-muted);
      }

      .theme-light .aganAnimeCard--StepControls button:hover {
        border-color: var(--interactive-accent);
        background: var(--background-secondary-alt);
        color: var(--text-normal);
      }

      .theme-light .aganAnimeCard--ManualInput {
        border-color: var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        color: var(--text-normal);
      }

      .theme-light .aganAnimeGallery--Empty {
        color: var(--text-muted);
      }

      .theme-light .aganAnimeGallery--EmptyTitle {
        color: var(--text-normal);
      }

    `);

    return () => undefined;
  },
};
