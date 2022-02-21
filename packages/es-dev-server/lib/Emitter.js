export class Emitter {
    /**
     * @type {{ [key: string]: Function[] }}
     */
    #listeners = {};

    /**
     * Register event listener.
     * @param {string} type
     * @param {Function} listener
     */
    on(type, listener) {
        this.#listeners[type] = this.#listeners[type] || [];
        this.#listeners[type].push(listener);

        return () => this.off(type, listener);
    }

    /**
     * Unregister event listener.
     * @param {string} type
     * @param {Function} listener
     */
    off(type, listener) {
        const listeners = this.#listeners[type];
        if (!listeners) {
            return;
        }

        const index = listeners.indexOf(listener);
        if (index === -1) {
            return;
        }

        this.#listeners[type].splice(index, 1);
    }

    /**
     * Emit event.
     * @param {string} type
     * @param {any[]} data
     * @return {Promise<void>|void}
     */
    trigger(type, ...data) {
        const listeners = this.#listeners[type];
        if (!listeners) {
            return;
        }

        let res;
        for (const listener of listeners) {
            if (res instanceof Promise) {
                res = res.then(() => listener.call(this, ...data));
            } else {
                res = listener.call(this, ...data);
            }
        }

        if (res instanceof Promise) {
            return res.then(() => { });
        }
    }
}
