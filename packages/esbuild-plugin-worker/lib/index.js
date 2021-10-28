import path from 'path';
import { readFile } from 'fs/promises';
import { resolve as defaultResolve } from '@chialab/node-resolve';
import emitPlugin, { emitChunk } from '@chialab/esbuild-plugin-emit';
import { setupPluginDependencies } from '@chialab/esbuild-helpers';
import { pipe, walk, generate, getSpan } from '@chialab/estransform';
import { getEntry, finalizeEntry, createFilter, getParentBuild, transformError } from '@chialab/esbuild-plugin-transform';
import metaUrlPlugin, { getMetaUrl } from '@chialab/esbuild-plugin-meta-url';

/**
 * @typedef {{ resolve?: typeof defaultResolve, constructors?: string[], proxy?: boolean }} PluginOptions
 */

/**
 * Create a blob proxy worker code.
 * @param {string} argument The url reference.
 * @param {import('@chialab/esbuild-plugin-emit').EmitTransformOptions} transformOptions The transform options for the url.
 */
function createBlobProxy(argument, transformOptions) {
    const createUrlFn = `(function(path) {
    const url = new URL(path);
    url.searchParams.set('transform', '${JSON.stringify(transformOptions)}');
    return url.href;
})`;
    const blobContent = transformOptions.format === 'esm' ?
        `'import "' + ${createUrlFn}(${argument}) + '";'` :
        `'importScripts("' + ${createUrlFn}(${argument}) + '");'`;

    return `URL.createObjectURL(new Blob([${blobContent}], { type: 'text/javascript' }))`;
}

/**
 * Instantiate a plugin that collect and builds Web Workers.
 * @param {PluginOptions} options
 * @return An esbuild plugin.
 */
export default function({ resolve = defaultResolve, constructors = ['Worker', 'SharedWorker'], proxy = false } = {}) {
    /**
     * @type {import('esbuild').Plugin}
     */
    const plugin = {
        name: 'worker',
        async setup(build) {
            await setupPluginDependencies(getParentBuild(build) || build, plugin, [
                emitPlugin(),
            ]);

            const { sourcesContent } = build.initialOptions;

            build.onResolve({ filter: /(\?|&)loader=worker$/ }, async ({ path: filePath }) => ({
                path: filePath.split('?')[0],
                namespace: 'worker',
            }));

            build.onLoad({ filter: /\./, namespace: 'worker' }, async ({ path: filePath }) => ({
                contents: await readFile(filePath),
                loader: 'file',
            }));

            build.onLoad({ filter: createFilter(build), namespace: 'file' }, async (args) => {
                /**
                 * @type {import('@chialab/estransform').Pipeline}
                 */
                const entry = args.pluginData || await getEntry(build, args.path);
                if (constructors.every((ctr) => !entry.code.includes(ctr))) {
                    return;
                }

                try {
                    await pipe(entry, {
                        source: path.basename(args.path),
                        sourcesContent,
                    }, async (data) => {
                        /**
                         * @type {Promise<void>[]}
                         */
                        const promises = [];

                        walk(data.ast, {
                            NewExpression(node) {
                                const callee = node.callee;
                                const calleeIdentifier = callee.type === 'MemberExpression' ? (() => {
                                    if (callee.object.type !== 'Identifier') {
                                        return;
                                    }
                                    if (callee.object.value !== 'window' &&
                                        callee.object.value !== 'self' &&
                                        callee.object.value !== 'globalThis') {
                                        return;
                                    }

                                    return callee.property;
                                })() : node.callee;

                                if (!calleeIdentifier || calleeIdentifier.type !== 'Identifier') {
                                    return;
                                }

                                if (!constructors.includes(calleeIdentifier.value)) {
                                    return;
                                }

                                if (!node.arguments.length) {
                                    return;
                                }

                                /**
                                 * @type {import('@chialab/esbuild-plugin-emit').EmitTransformOptions}
                                 */
                                const transformOptions = {
                                    format: 'iife',
                                    bundle: true,
                                    platform: 'neutral',
                                };
                                const options = node.arguments[1] && node.arguments[1].expression;
                                if (options &&
                                    options.type === 'ObjectExpression' &&
                                    options.properties &&
                                    options.properties.some(
                                        /**
                                         * @param {*} prop
                                         */
                                        (prop) =>
                                            prop.type === 'Property' &&
                                            prop.key?.name === 'type' &&
                                            prop.value?.value === 'module'
                                    )
                                ) {
                                    transformOptions.format = 'esm';
                                    transformOptions.bundle = false;
                                } else {
                                    transformOptions.splitting = false;
                                    transformOptions.inject = [];
                                    transformOptions.plugins = [];
                                }

                                const firstArg = /** @type {import('@chialab/estransform').StringLiteral|import('@chialab/estransform').NewExpression|import('@chialab/estransform').MemberExpression} */ (node.arguments[0] && node.arguments[0].expression);
                                const value = firstArg.type === 'StringLiteral' ? firstArg.value : getMetaUrl(firstArg, data.ast);
                                promises.push(Promise.resolve().then(async () => {
                                    const { start, end } = getSpan(data.ast, node);

                                    if (typeof value !== 'string') {
                                        if (proxy) {
                                            const arg = await generate(firstArg);
                                            data.magicCode.overwrite(start, end, `new ${calleeIdentifier.value}(${createBlobProxy(arg, transformOptions)})`);
                                        }
                                        return;
                                    }
                                    const resolvedPath = await resolve(value, args.path);
                                    const entryPoint = emitChunk(resolvedPath, transformOptions);
                                    const arg = `new URL('${entryPoint}', import.meta.url).href`;
                                    if (proxy) {
                                        data.magicCode.overwrite(start, end, `new ${calleeIdentifier.value}(${createBlobProxy(arg, transformOptions)})`);
                                    } else {
                                        data.magicCode.overwrite(start, end, `new ${calleeIdentifier.value}(${arg})`);
                                    }
                                }));
                            },
                        });

                        await Promise.all(promises);
                    });
                } catch (error) {
                    throw transformError(this.name, error);
                }

                return finalizeEntry(build, args.path);
            });

            await setupPluginDependencies(build, plugin, [
                metaUrlPlugin({ resolve }),
            ], 'after');
        },
    };

    return plugin;
}
