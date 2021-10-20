import { EventEmitter } from 'events';

/**
 * @typedef {Object} RunnerOptions
 * @property {import('mocha').MochaOptions} [mochaOptions]
 */

/**
 * @template {RunnerOptions} T
 */
export class Runner extends EventEmitter {
    /**
     * @type {T}
     */
    options;

    /**
     * @type {import('@web/dev-server-core').DevServer|undefined}
     */
    devServer;

    /**
     * @param {T} options
     */
    constructor(options) {
        super();
        this.options = options;
    }

    /**
     * @param {import('@web/dev-server-core').DevServer} devServer
     */
    run(devServer) {
        this.devServer = devServer;
    }
}
