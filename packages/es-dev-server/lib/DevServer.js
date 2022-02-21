import express from 'express';
import { watch } from 'chokidar';
import { Emitter } from './Emitter.js';
import { logger } from './Logger.js';
import { WebSocket } from './WebSocket.js';
import getPort from 'get-port';

/**
 * @typedef {(entrypoints: string[], reloadScript: string) => void} ReloadCallback
 */

/**
 * @typedef {(filePath: string, req: Request, res: Response) => void} ServeEventCallback
 */

/**
 * @typedef {(filePath: string, reload: ReloadCallback) => void} FileChangedEventCallback
 */

/**
 * @typedef {(server: DevServer) => void} Plugin
 */

/**
 * @typedef {import('express').RequestHandler} Middleware
 */

/**
 * @typedef {Object} DevServerConfig
 * @property {string} root The root directory of the dev server.
 * @property {number} [port] The server port to listen.
 * @property {string} [hostname] The server hostname to use.
 * @property {boolean} [https] The server should use https.
 * @property {Plugin[]} [plugins] List of plugins to use.
 * @property {Middleware[]} [middlewares] List of middlewares to use.
 * @property {import('./Logger.js').Logger} [logger] The logger to use.
 */

export class DevServer extends Emitter {
    /**
     * @type {import('http').Server|undefined}
     */
    server;

    /**
     * Create a dev server instance.
     * @param {DevServerConfig} config
     */
    constructor(config) {
        super();
        this.app = express();
        this.webSocket = new WebSocket();
        this.root = config.root;
        this.port = config.port;
        this.hostname = config.hostname || '0.0.0.0';
        this.protcol = config.https ? 'https' : 'http';

        this.logger = config.logger || logger;
        this.fileWatcher = watch(this.root);

        const plugins = this.plugins = config.plugins || [];
        plugins.forEach((plugin) => plugin(this));
        const middlewares = this.middlewares = config.middlewares || [];
        this.app.use(...middlewares);

        this.fileWatcher.on('change', this.onFileChange);
        this.fileWatcher.on('unlink', this.onFileChange);
    }

    /**
     * Start the dev server.
     * @param {number} [port] The port to listen to.
     * @return {Promise<void>}
     */
    async listen(port) {
        const actualPort = port || this.port || await getPort({ port: 3000 });

        await new Promise((resolve) => {
            this.server = this.app.listen(actualPort, this.hostname, () => resolve(this.server));
        });

        await this.trigger('start');
    }

    /**
     * Stop the dev server.
     */
    async close() {
        this.server?.close();
        this.fileWatcher.off('change', this.onFileChange);
        this.fileWatcher.off('unlink', this.onFileChange);
    }

    /**
     * Send a livereload message.
     * @param {string[]} entrypoints List of entrypoints.
     * @param {string} reloadScript The livereload script to use.
     */
    reload(entrypoints, reloadScript) {

    }

    /**
     * Get the root of the dev server.
     */
    getRoot() {
        return this.root;
    }

    /**
     * Get the server address.
     */
    getAddress() {
        return {
            protcol: this.protcol,
            hostname: this.hostname,
            port: this.port,
        };
    }

    /**
     * Get livereload web socket.
     */
    getWebSocket() {
        return this.webSocket;
    }

    /**
     * Handle file changes.
     * @param {string} filePath The changed file path.
     */
    onFileChange = (filePath) => this.trigger('fileChanged', filePath);

    /**
     * Add file to watch list.
     * @param {string} filePath The changed file path.
     */
    watchFile(filePath) {
        this.fileWatcher.add(filePath);
    }

    /**
     * Remove a file from the watch list.
     * @param {string} filePath The changed file path.
     */
    unwatchFile(filePath) {
        this.fileWatcher.unwatch(filePath);
    }
}
