const test = require('node:test');
const assert = require('node:assert/strict');
const plugin = require('../媒体库-动画卡片.xdb.js');

class FakeNode {
  constructor(tag = '') {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.classList = { add() {}, remove() {} };
    this.listeners = new Map();
    this.clientWidth = 1000;
    this.value = '';
  }

  addEventListener(type, listener) { this.listeners.set(type, listener); }
  setAttribute() {}

  appendChild(child) {
    if (child.tag === 'fragment') {
      for (const node of [...child.children]) this.appendChild(node);
      return child;
    }
    child.remove();
    this.children.push(child);
    child.parent = this;
    return child;
  }

  append(...children) { for (const child of children) this.appendChild(child); }

  replaceChildren(...children) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...children);
  }

  insertBefore(child, reference) {
    if (child.tag === 'fragment') {
      for (const node of [...child.children]) this.insertBefore(node, reference);
      return child;
    }
    child.remove();
    const index = this.children.indexOf(reference);
    assert.notEqual(index, -1);
    this.children.splice(index, 0, child);
    child.parent = this;
    return child;
  }

  remove() {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index !== -1) this.parent.children.splice(index, 1);
    this.parent = null;
  }
}

test('渐进加载只读取新卡片，宿主更新仍刷新现有卡片', async () => {
  const originalDocument = global.document;
  const originalObserver = global.IntersectionObserver;
  const originalResizeObserver = global.ResizeObserver;
  let observer;
  global.document = {
    createElement: (tag) => new FakeNode(tag),
    createDocumentFragment: () => new FakeNode('fragment'),
  };
  global.ResizeObserver = undefined;
  global.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; observer = this; }
    observe() { this.observed = true; }
    disconnect() { this.observed = false; }
    trigger() { assert.equal(this.observed, true); this.callback([{ isIntersecting: true }]); }
  };

  let extension;
  const reads = new Map();
  const rows = Array.from({ length: 50 }, (_, index) => ({
    id: String(index),
    $item: { 中文名: String(index).padStart(2, '0'), 状态: '▶️ 进行中', 总集数: 12 },
  }));
  const props = {
    container: new FakeNode('root'),
    viewData: { groups: [{ rows }] },
    api: { getRowLink: (id) => ({ href: id }) },
    markdown: {
      read: async (path) => {
        reads.set(path, (reads.get(path) ?? 0) + 1);
        return '**已观看集数**： 1';
      },
    },
  };

  try {
    plugin.install({
      registerFieldType: () => true,
      registerFieldRenderer() {},
      registerDatabaseView(value) { extension = value; },
      registerStyleSheet() {},
    });
    const view = extension.view();
    view.onUpdate(props);
    await Promise.resolve();
    assert.equal(reads.size, 24);
    observer.trigger();
    await Promise.resolve();
    assert.equal(reads.size, 48);
    assert.equal(reads.get('0'), 1);
    observer.trigger();
    await Promise.resolve();
    assert.equal(reads.size, 50);
    assert.equal(reads.get('0'), 1);
    assert.equal(observer.observed, false);

    view.onUpdate(props);
    await Promise.resolve();
    assert.equal(reads.get('0'), 2);
    assert.equal(reads.get('49'), 2);

    const find = (node, className) =>
      node.className === className
        ? node
        : node.children.map((child) => find(child, className)).find(Boolean);
    const search = find(props.container, 'aganAnimeGallery--Search');
    search.value = '49';
    search.listeners.get('input')();
    await Promise.resolve();
    assert.equal(reads.get('49'), 3);
    assert.equal(observer.observed, false);

    view.onDestroy();
  } finally {
    global.document = originalDocument;
    global.IntersectionObserver = originalObserver;
    global.ResizeObserver = originalResizeObserver;
  }
});
