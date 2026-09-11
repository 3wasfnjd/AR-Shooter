/** Simple generic object pool: reuses instances instead of alloc/GC churn. */
export class ObjectPool {
  constructor(factory, reset, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    this.active = new Set();
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }

  acquire() {
    const item = this.free.pop() || this.factory();
    this.active.add(item);
    return item;
  }

  release(item) {
    if (!this.active.has(item)) return;
    this.active.delete(item);
    if (this.reset) this.reset(item);
    this.free.push(item);
  }

  releaseAll() {
    for (const item of Array.from(this.active)) this.release(item);
  }
}
