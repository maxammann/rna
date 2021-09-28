import path from 'path';
import { readConfigFile, mergeConfig, locateConfigFile } from '@chialab/rna-config-loader';
import { createTransformOptions, loadPlugins } from '@chialab/rna-bundler';
import { createLogger, colors } from '@chialab/rna-logger';
import { DevServer } from '@chialab/esbuild-plugin-dev-server';

// /**
//  * @param {DevServerConfig} config
//  */
// export async function buildPlugins(config) {
//     const [
//         { default: nodeResolvePlugin },
//         { rnaPlugin, entrypointsPlugin },
//     ] = await Promise.all([
//         import('@chialab/wds-plugin-node-resolve'),
//         import('@chialab/wds-plugin-rna'),
//     ]);

//     return [
//         rnaPlugin({
//             alias: config.alias,
//             jsxFactory: config.jsxFactory,
//             jsxFragment: config.jsxFragment,
//             jsxModule: config.jsxModule,
//             jsxExport: config.jsxExport,
//             transformPlugins: config.transformPlugins,
//         }),
//         entrypointsPlugin(config.entrypoints, config.entrypointsPath),
//         nodeResolvePlugin({
//             alias: config.alias,
//         }),
//     ];
// }

// export async function buildDevPlugins() {
//     const [
//         { hmrPlugin },
//         { hmrCssPlugin },
//         { watchPlugin },
//     ] = await Promise.all([
//         import('./plugins/hmr.js'),
//         import('@chialab/wds-plugin-hmr-css'),
//         import('./plugins/watch.js'),
//     ]);

//     return [
//         hmrPlugin(),
//         watchPlugin(),
//         hmrCssPlugin(),
//     ];
// }

/**
 * Start the dev server.
 * @param {import('@chialab/esbuild-plugin-dev-server').DevServerConfig} serveConfig
 * @param {import('@chialab/rna-config-loader').Config} buildConfig
 * @return {Promise<DevServer>} The dev server instance.
 */
export async function serve(serveConfig, buildConfig) {
    const rootDir = serveConfig.rootDir ? path.resolve(serveConfig.rootDir) : process.cwd();
    const server = new DevServer({
        ...serveConfig,
        rootDir,
    }, await createTransformOptions(buildConfig, [
        ...(await loadPlugins({
            postcss: {},
        })),
    ], [
        await import('@chialab/esbuild-plugin-node-resolve')
            .then(({ default: plugin }) => plugin()),
    ]));

    const logger = createLogger();
    server.on('log',
        /**
         * @param {import('@chialab/esbuild-plugin-dev-server').DevServerLogEvent} event
         */
        ({ type, messages }) => {
            logger[type](...messages);
        }
    );

    await server.start();

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
                configFile = configFile || await locateConfigFile();

                const logger = createLogger();

                /**
                 * @type {import('@chialab/rna-config-loader').Config}
                 */
                const buildConfig = mergeConfig({ root }, configFile ? await readConfigFile(configFile, { root }, 'serve') : {});

                /**
                 * @type {import('@chialab/esbuild-plugin-dev-server').DevServerConfig}
                 */
                const serveConfig = {
                    rootDir: buildConfig.root,
                    port,
                    // entrypointsPath: config.entrypointsPath,
                    // entrypoints: config.entrypoints,
                    // alias: config.alias,
                    // plugins,
                    // jsxFactory: config.jsxFactory,
                    // jsxFragment: config.jsxFragment,
                    // jsxModule: config.jsxModule,
                    // jsxExport: config.jsxExport,
                    // transformPlugins: config.transformPlugins,
                };

                // try {
                //     const { legacyPlugin } = await import('@chialab/wds-plugin-legacy');
                //     plugins.push(legacyPlugin({
                //         minify: true,
                //     }));
                // } catch (err) {
                //     //
                // }

                const server = await serve(serveConfig, buildConfig);

                logger.log(`
  ${colors.bold('rna dev server started')}

  root:     ${colors.blue.bold(path.resolve(serveConfig.rootDir || root))}
  local:    ${colors.blue.bold(`http://${server.host}:${server.port}/`)}
`);
            }
        );
}
