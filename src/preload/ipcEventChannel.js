import { ipcRenderer } from 'electron';

export class IpcEventChannel {
  constructor(channelName) {
    this.channelName = channelName;
    this.listeners = new Set();
    this._boundHandler = this._handler.bind(this);
    this._isSubscribed = false;
  }

  _handler(_event, payload) {
    // Forward payload to all registered callbacks
    for (const cb of this.listeners) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Listener error on ${this.channelName}`, err);
      }
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);

    // Attach ipc listener only once
    if (!this._isSubscribed) {
      ipcRenderer.on(this.channelName, this._boundHandler);
      this._isSubscribed = true;
    }

    // Return unsubscribe function
    return () => {
      this.unsubscribe(callback);
    };
  }

  unsubscribe(callback) {
    this.listeners.delete(callback);

    // Remove ipc listener when no subscribers left
    if (this.listeners.size === 0 && this._isSubscribed) {
      ipcRenderer?.removeListener(this.channelName, this._boundHandler);
      this._isSubscribed = false;
    }
  }
}
