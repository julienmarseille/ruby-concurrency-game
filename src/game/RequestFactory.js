import { REQ_TYPES } from '../config.js';

export class RequestFactory {
  constructor() {
    this._nextId = 0;
  }

  create(type) {
    return { id: ++this._nextId, type, def: REQ_TYPES[type] };
  }

  createRandom(pool) {
    const type = pool[Math.floor(Math.random() * pool.length)];
    return this.create(type);
  }
}
