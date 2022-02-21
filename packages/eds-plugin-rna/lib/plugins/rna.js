import path from 'path';
import { pkgUp, browserResolve, isJs, isJson, isCss, getSearchParam, getSearchParams, ALIAS_MODE, createAliasRegexexMap, createEmptyRegex } from '@chialab/node-resolve';
import { isHelperImport, resolveRelativeImport } from '@chialab/wds-plugin-node-resolve';
import { transform, build } from '@chialab/rna-bundler';
import { realpath } from 'fs/promises';
import { fileModules } from '../middlewares/FileModules.js';
import { cssModules } from '../middlewares/CssModules.js';
import { createVirtualFS, virtualModules } from '../middlewares/VirtualModules.js';
import { cssBuild } from '../middlewares/CssBuild.js';
import { watchDependencies } from '../helpers.js';

const VALID_MODULE_NAME = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

/**
 * @param {string} name
 */
function isBareModuleSource(name) {
    return VALID_MODULE_NAME.test(name);
}

/**
 * @param {Partial<import('@chialab/rna-config-loader').CoreTransformConfig>} config
 */
export function rnaPlugin(config) {
    const aliasMap = config.alias || {};
    const aliasRegexes = createAliasRegexexMap(aliasMap, ALIAS_MODE.FULL);
    const emptyRegex = createEmptyRegex(aliasMap);

    /**
     * @type {import('@web/dev-server-core').DevServerCoreConfig}
     */
    let serverConfig;

    /**
     * @type {import('chokidar').FSWatcher}
     */
    let serverFileWatcher;

    const virtualFs = createVirtualFS();

    /**
     * @type {import('@chialab/esbuild-rna').DependenciesMap}
     */
    const dependenciesMap = {};

    /**
     * @param {string} path
     */
    function invalidateVirtualFs(path) {
        delete virtualFs[path];
    }

    /**
     * @type {import('@chialab/es-dev-server').Plugin}
     */
    const plugin = (server) => {
        server.app.use(
            fileModules(server.getRoot()),
            cssModules(),
            virtualModules(server.getRoot(), virtualFs),
            cssBuild(server.getRoot(), config, (filePath, build) => {
                virtualFs[filePath] = build
                    .then((result) => {
                        const outputFiles = /** @type {import('esbuild').OutputFile[]} */ (result.outputFiles);
                        outputFiles.forEach(({ path, contents }) => {
                            virtualFs[path] = Promise.resolve(
                                Buffer.from(contents.buffer.slice(contents.byteOffset, contents.byteLength + contents.byteOffset))
                            );
                        });

                        watchDependencies(server, dependenciesMap, result);

                        return virtualFs[filePath];
                    })
            })
        );

        async transform(context) {
            if (isHelperImport(context.url)) {
                return;
            }

            if (isCssModuleRequest(context.url) ||
                isFileRequest(context.url)
            ) {
                // do not transpile to js module
                return;
            }

            const loader = getRequestLoader(context);
            if (!loader) {
                return;
            }

            if (loader === 'json' && !isJsonModuleRequest(context.url)) {
                // do not transpile to js module
                return;
            }

            const { rootDir } = serverConfig;
            const filePath = getRequestFilePath(context.url, rootDir);
            if (filePath in virtualFs) {
                return;
            }

            const contextConfig = JSON.parse(getSearchParam(context.url, 'transform') || '{}');

            /**
             * @type {import('@chialab/rna-config-loader').Entrypoint}
             */
            const entrypoint = {
                root: rootDir,
                input: `./${path.relative(rootDir, filePath)}`,
                code: /** @type {string} */ (context.body),
                loader,
                bundle: false,
                ...contextConfig,
            };

            const transformConfig = await createConfig(entrypoint, config);
            const result = await transform(transformConfig);
            watchDependencies(result);

            return result.code;
        },

        async transformImport({ source }) {
            if (isJson(source)) {
                return appendJsonModuleParam(source);
            }

            if (isCss(source)) {
                return appendCssModuleParam(source);
            }

            if (!isJs(source)) {
                return appendFileParam(source);
            }
        },

        async resolveImport({ source, context }) {
            if (source.match(emptyRegex)) {
                return;
            }

            const { rootDir } = serverConfig;
            const filePath = getRequestFilePath(context.url, rootDir);

            for (const [regex, res] of aliasRegexes.entries()) {
                if (source.match(regex)) {
                    const aliasValue = res.value;
                    const aliased = typeof aliasValue === 'function' ?
                        await aliasValue(filePath) :
                        aliasValue;
                    if (!aliased) {
                        return;
                    }

                    source = aliased;
                    break;
                }
            }

            if (!isBareModuleSource(source)) {
                return;
            }

            const resolved = await browserResolve(source, filePath).catch(() => null);
            if (!resolved) {
                return;
            }

            const realPath = await realpath(resolved);
            if (realPath !== resolved) {
                // ignore symlinked files
                return;
            }

            if (resolved in virtualFs) {
                return resolveRelativeImport(resolved, filePath, rootDir);
            }

            const modulePackageFile = await pkgUp({ cwd: resolved });
            const moduleRootDir = modulePackageFile ? path.dirname(modulePackageFile) : rootDir;

            /**
             * @type {import('@chialab/rna-config-loader').Entrypoint}
             */
            const entrypoint = {
                root: moduleRootDir,
                input: `./${path.relative(moduleRootDir, resolved)}`,
                loader: getRequestLoader(context),
                bundle: false,
            };

            virtualFs[resolved] = createConfig(entrypoint, config)
                .then((transformConfig) =>
                    build({
                        ...transformConfig,
                        chunkNames: '[name]-[hash]',
                        output: resolved,
                        jsxModule: undefined,
                        write: false,
                    })
                ).then((result) => {
                    if (!result.outputFiles) {
                        throw new Error('Failed to bundle dependency');
                    }

                    result.outputFiles.forEach(({ path, contents }) => {
                        virtualFs[path] = Promise.resolve(
                            Buffer.from(contents.buffer.slice(contents.byteOffset, contents.byteLength + contents.byteOffset))
                        );
                    });

                    watchDependencies(result);

                    return virtualFs[resolved];
                });

            return resolveRelativeImport(resolved, filePath, rootDir);
        },
    };

    return plugin;
}
