import path from 'path';
import { getSearchParam, appendSearchParam, removeSearchParam } from '@chialab/node-resolve';
import { getEntryConfig } from '@chialab/rna-config-loader';
import { transformLoaders } from '@chialab/rna-bundler';

/**
 * @param {string} url
 */
export function isFileRequest(url) {
    return getSearchParam(url, 'emit') === 'file' || getSearchParam(url, 'loader') === 'file';
}

/**
 * @param {string} url
 */
export function isChunkRequest(url) {
    return getSearchParam(url, 'emit') === 'chunk';
}

/**
 * @param {string} url
 */
export function isCssModuleRequest(url) {
    return getSearchParam(url, 'loader') === 'css';
}

/**
 * @param {string} url
 */
export function isJsonModuleRequest(url) {
    return getSearchParam(url, 'loader') === 'json';
}

/**
 * @param {string} source
 */
export function appendCssModuleParam(source) {
    return appendSearchParam(source, 'loader', 'css');
}

/**
 * @param {string} source
 */
export function appendJsonModuleParam(source) {
    return appendSearchParam(source, 'loader', 'json');
}

/**
 * @param {string} source
 */
export function appendFileParam(source) {
    return appendSearchParam(source, 'loader', 'file');
}

/**
 * @param {string} source
 */
export function convertCssToJsModule(source) {
    source = removeSearchParam(source, 'loader');
    return `var link = document.createElement('link');
link.rel = 'stylesheet';
link.href = '${source}';
document.head.appendChild(link);
`;
}

/**
 * @param {string} source
 */
export function convertFileToJsModule(source) {
    source = removeSearchParam(source, 'emit');
    source = removeSearchParam(source, 'loader');
    return `export default new URL('${source}', import.meta.url).href;`;
}

/**
 * @param {import('koa').Context} context
 */
export function getRequestLoader(context) {
    const fileExtension = path.posix.extname(context.path);
    return transformLoaders[fileExtension];
}

/**
 * @param {import('@chialab/rna-config-loader').Entrypoint} entrypoint
 * @param {Partial<import('@chialab/rna-config-loader').CoreTransformConfig>} config
 */
export async function createConfig(entrypoint, config) {
    return getEntryConfig(entrypoint, {
        sourcemap: 'inline',
        target: 'es2020',
        platform: 'browser',
        jsxFactory: config.jsxFactory,
        jsxFragment: config.jsxFragment,
        jsxModule: config.jsxModule,
        jsxExport: config.jsxExport,
        alias: config.alias,
        plugins: [
            ...await Promise.all([
                import('@chialab/esbuild-plugin-worker')
                    .then(({ default: plugin }) => plugin({
                        proxy: true,
                        emit: false,
                    })),
                import('@chialab/esbuild-plugin-meta-url')
                    .then(({ default: plugin }) => plugin({
                        emit: false,
                    })),
                import('@chialab/esbuild-plugin-postcss')
                    .then(({ default: plugin }) => plugin())
                    .catch(() => ({ name: 'postcss', setup() { } })),
            ]),
            ...(config.plugins || []),
        ],
        logLevel: 'error',
    });
}

/**
 * @param {import('@chialab/es-dev-server').DevServer} server
 * @param {import('@chialab/esbuild-rna').DependenciesMap} dependenciesMap
 * @param {import('@chialab/rna-bundler').TransformResult|import('@chialab/esbuild-rna').Result} result
 */
export function watchDependencies(server, dependenciesMap, { dependencies }) {
    const watchedDependencies = Object.values(dependenciesMap).flat();
    for (const key in dependencies) {
        if (key in dependenciesMap) {
            dependenciesMap[key]
                .forEach((file) => {
                    if (watchedDependencies.filter((f) => f === file).length === 1) {
                        server.unwatchFile(file);
                    }
                });
        }

        dependencies[key]
            .forEach((file) => server.watchFile(file));
    }

    Object.assign(dependenciesMap, dependencies);
}
