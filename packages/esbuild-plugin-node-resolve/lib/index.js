import path from 'path';
import { pipe, parseEsm } from '@chialab/estransform';
import { getEntry, finalizeEntry, createFilter } from '@chialab/esbuild-plugin-transform';
import { browserResolve, resolve } from '@chialab/node-resolve';

/**
 * @typedef {Object} PluginOptions
 * @property {import('@chialab/node-resolve').Resolver} [resolver]
 */

/**
 * Resolve and rewrite dependencies urls using the node resolution algorithm.
 * @param {PluginOptions} options
 * @return An esbuild plugin.
 */
export default function({ resolver = () => Promise.resolve(null) } = {}) {
    /**
     * @type {import('esbuild').Plugin}
     */
    const plugin = {
        name: 'node-resolve',
        setup(build) {
            const options = build.initialOptions;
            const defaultResolver = options.platform === 'browser' ? browserResolve : resolve;

            build.onLoad({ filter: createFilter(build), namespace: 'file' }, async (args) => {
                /**
                 * @type {import('@chialab/estransform').Pipeline}
                 */
                const entry = args.pluginData || await getEntry(build, args.path);

                await pipe(entry, {
                    source: path.basename(args.path),
                    sourcesContent: options.sourcesContent,
                }, async ({ magicCode, code }) => {
                    const [imports] = await parseEsm(code);

                    await Promise.all(
                        imports.map(async (entry) => {
                            if (!entry.n) {
                                return;
                            }

                            const resolved = await resolver(entry.n, args.path) ||
                                await defaultResolver(entry.n, args.path);

                            if (!resolved) {
                                return;
                            }

                            magicCode.overwrite(entry.s, entry.e, `./${path.relative(path.dirname(args.path), resolved)}`);
                        })
                    );
                });

                return finalizeEntry(build, args.path);
            });
        },
    };

    return plugin;
}
