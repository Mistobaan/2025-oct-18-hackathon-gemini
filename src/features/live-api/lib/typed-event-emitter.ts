'use client';

/**
 * Minimal event emitter implementation tailored for browser usage.
 */

export type EventMap = Record<string, (...args: any[]) => void>;

export class TypedEventEmitter<TEvents extends EventMap> {
  private listeners: { [K in keyof TEvents]?: Set<TEvents[K]> } = {};

  on<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    const existing = this.listeners[event] ?? new Set<TEvents[K]>();
    existing.add(listener);
    this.listeners[event] = existing;
    return this;
  }

  off<K extends keyof TEvents>(event: K, listener: TEvents[K]): this {
    const existing = this.listeners[event];
    if (existing) {
      existing.delete(listener);
      if (existing.size === 0) {
        delete this.listeners[event];
      }
    }
    return this;
  }

  emit<K extends keyof TEvents>(event: K, ...args: Parameters<TEvents[K]>): boolean {
    const existing = this.listeners[event];
    if (!existing || existing.size === 0) {
      return false;
    }
    existing.forEach((handler) => {
      handler(...args);
    });
    return true;
  }
}
