import { stat } from 'fs/promises';
import path from 'path';
import { readConfigFile, mergeConfig, locateConfigFile } from '@chialab/rna-config-loader';
import { createLogger, colors } from '@chialab/rna-logger';
import { DevServer, getPort, portNumbers, Hmr, cors } from '@chialab/es-dev-server';
import nodeResolvePlugin from '@chialab/wds-plugin-node-resolve';
import { rnaPlugin, entrypointsPlugin } from '@chialab/eds-plugin-rna';

/**
 * Load configuration for the dev server.
 * @param {Partial<import('@chialab/es-dev-server').DevServer>} [initialConfig]
 * @param {string} [configFile]
 * @return {Promise<import('@chialab/es-dev-server').DevServer>}
 */
export async function loadDevServerConfig(initialConfig = {}, configFile = undefined) {
    configFile = configFile || await locateConfigFile();

    const rootDir = initialConfig.root || process.cwd();
    const logger = createLogger();

    /**
     * @type {import('@chialab/rna-config-loader').Config}
     */
    const config = mergeConfig(
        { root: rootDir },
        configFile ? await readConfigFile(configFile, { root: rootDir }, 'serve') : {}
    );

    const { servePlugins = [], plugins: transformPlugins = [] } = config;

    try {
        const { legacyPlugin } = await import('@chialab/eds-plugin-legacy');
        servePlugins.push(legacyPlugin({
            minify: true,
        }));
    } catch (err) {
        //
    }

    return {
        rootDir: config.root,
        entrypointsPath: config.entrypointsPath,
        entrypoints: config.entrypoints,
        alias: config.alias,
        logger,
        plugins: servePlugins,
        transformPlugins,
        jsxFactory: config.jsxFactory,
        jsxFragment: config.jsxFragment,
        jsxModule: config.jsxModule,
        jsxExport: config.jsxExport,
        ...initialConfig,
    };
}

/**
 * Create a dev server.
 * @param {import('@chialab/es-dev-server').DevServer} config
 * @return {Promise<import('@chialab/es-dev-server').DevServer>} The dev server instance.
 */
export async function createDevServer(config) {
    const root = config.root ? path.resolve(config.root) : process.cwd();
    const appIndex = path.join(root, 'index.html');
    let index = false;
    try {
        index = (await stat(appIndex)).isFile();
    } catch {
        //
    }
    const server = new DevServer({
        logger: config.logger || createLogger(),
        appIndex: index ? appIndex : undefined,
        ...config,
        injectWebSocket: true,
        hostname: config.hostname || 'localhost',
        port: config.port || await getPort({
            port: [
                ...portNumbers(8080, 8090),
                ...portNumbers(3000, 3100),
            ],
        }),
        rootDir: root,
        middleware: [
            cors(),
            ...(config.middlewares || []),
        ],
        plugins: [
            ...(config.plugins || []),
            rnaPlugin({
                alias: config.alias,
                jsxFactory: config.jsxFactory,
                jsxFragment: config.jsxFragment,
                jsxModule: config.jsxModule,
                jsxExport: config.jsxExport,
                plugins: config.transformPlugins,
            }),
            entrypointsPlugin(config.entrypoints),
            nodeResolvePlugin({
                alias: config.alias,
            }),
            Hmr,
        ],
    });

    return server;
}

/**
 * Use a dev server instance as a middleware.
 *
 * @param {import('@chialab/es-dev-server').DevServer} server
 * @return The middleware instance for the dev server.
 */
export function middleware(server) {
    return server.app;
}

/**
 * Start the dev server.
 * @param {import('@chialab/es-dev-server').DevServerConfig} config
 * @return {Promise<import('@chialab/es-dev-server').DevServer>} The dev server instance.
 */
export async function serve(config) {
    const root = config.root || process.cwd();
    const server = await createDevServer({
        ...config,
        root,
    });

    await server.listen();

    process.on('uncaughtException', error => {
        config.logger?.error(error);
    });

    process.on('SIGINT', async () => {
        await server.close();
        process.exit(0);
    });

    return server;
}

/**
 * @typedef {Object} ServeCommandOptions
 * @property {number} [port]
 * @property {string} [config]
 */

/**
 * @param {import('commander').Command} program
 */
export function command(program) {
    program
        .command('serve [root]')
        .description('Start a web dev server (https://modern-web.dev/docs/dev-server/overview/) that transforms ESM imports for node resolution on demand. It also uses esbuild (https://esbuild.github.io/) to compile non standard JavaScript syntax.')
        .option('-P, --port <number>', 'server port number', parseInt)
        .option('-C, --config <path>', 'the rna config file')
        .action(
            /**
             * @param {string} root
             * @param {ServeCommandOptions} options
             */
            async (root = process.cwd(), { port, config: configFile }) => {
                const serveConfig = await loadDevServerConfig({
                    root,
                    port,
                }, configFile);

                const server = await serve(serveConfig);

                serveConfig.logger?.log(`
  ${colors.bold('rna dev server started')}

  root:     ${colors.blue.bold(path.resolve(serveConfig.root || root))}
  local:    ${colors.blue.bold(`http://${server.getAddress().hostname}:${server.getAddress().port}/`)}
`);
            }
        );
}
