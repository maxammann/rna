import { EventEmitter } from 'events';
import esbuild from 'esbuild';
import express from 'express';
import cors from 'cors';
import { createEsbuildMiddleware } from './esbuildMiddleware.js';

/**
 * @typedef {(request: express.Request, response: express.Response, next: express.NextFunction) => Promise<express.Response>} Middleware
 */

/**
 * @typedef {Object} DevServerLogEvent
 * @property {'log'|'warn'|'error'} type
 * @property {string[]} messages
 */

/**
 * @typedef {Object} DevServerConfig
 * @property {string} [rootDir]
 * @property {string} [host]
 * @property {number} [port]
 * @property {boolean} [http2]
 * @property {typeof esbuild} [esbuild]
 * @property {Middleware[]} [middlewares]
 */

export class DevServer extends EventEmitter {
    /**
     * @type {DevServerConfig}
     */
    #config;

    /**
     * @type {esbuild.BuildOptions}
     */
    #buildConfig;

    /**
     * @type {typeof esbuild}
     */
    #esbuild;

    /**
     * @type {import('http').Server | undefined}
     */
    #server;

    /**
     * @type {express.Express}
     */
    #app;

    get config() {
        return this.#config;
    }

    get server() {
        return this.#server;
    }

    get app() {
        return this.#app;
    }

    get host() {
        return this.config.host || '0.0.0.0';
    }

    get port() {
        return this.config.port || 3000;
    }

    /**
     * @param {DevServerConfig} config
     * @param {esbuild.BuildOptions} buildConfig
     */
    constructor(config, buildConfig) {
        super();
        this.#config = config;
        this.#buildConfig = buildConfig;
        this.#esbuild = config.esbuild || esbuild;
        this.#app = express();
    }

    async start() {
        const {
            rootDir = process.cwd(),
            http2 = false,
            middlewares = [],
        } = this.config;

        const { default: http } = await (http2 ? import('https') : import('http'));
        const app = this.#app
            .use(cors())
            // .get('/', injectImportMaps())
            .use(createEsbuildMiddleware({
                format: 'esm',
                ...this.#buildConfig,
            }, this.#esbuild))
            .use(express.static(rootDir));
        if (middlewares.length) {
            app.use(...middlewares);
        }

        const server = this.#server = http.createServer(this.#app);
        server.listen(this.port);

        process.on('uncaughtException', this.onUncaughtException);
        process.on('SIGINT', this.onSigint);

        return server;
    }

    /**
     * @param {Error} error
     */
    onUncaughtException = (error) => {
        this.emit('log', {
            type: 'error',
            messages: [error],
        });
    };

    onSigint = async () => {
        await this.stop();
        process.exit(0);
    };

    async stop() {
        /**
         * @type {Promise<void>}
         */
        const closePromise = new Promise((resolve, reject) => {
            if (!this.server) {
                throw new Error('Server not started.');
            }

            process.off('uncaughtException', this.onUncaughtException);
            process.off('SIGINT', this.onSigint);
            this.server.close((err) => (err ? reject(err) : resolve()));
        });

        await closePromise;
        this.#server = undefined;
    }
}
