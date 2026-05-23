export class GameEvents {
  constructor() {
    this._handlers = {};
  }

  on(event, fn) {
    (this._handlers[event] ??= []).push(fn);
    return this;
  }

  off(event, fn) {
    const handlers = this._handlers[event];
    if (handlers) this._handlers[event] = handlers.filter(h => h !== fn);
    return this;
  }

  emit(event, data) {
    this._handlers[event]?.forEach(fn => fn(data));
  }
}
