import path from 'path';
import { resolve as defaultResolve, isUrl } from '@chialab/node-resolve';
import { setupPluginDependencies } from '@chialab/esbuild-helpers';
import emitPlugin, { emitFileOrChunk, getBaseUrl, prependImportStatement } from '@chialab/esbuild-plugin-emit';
import { getSpan, pipe, walk } from '@chialab/estransform';
import { getEntry, finalizeEntry, createFilter, getParentBuild, transformError } from '@chialab/esbuild-plugin-transform';

/**
 * @typedef {{ resolve?: typeof defaultResolve }} PluginOptions
 */

/**
 * Detect first level identifier for esbuild file loader imports.
 * File could be previously bundled using esbuild, so the first argument of a new URL(something, import.meta.url)
 * is not a literal anymore but an identifier.
 * Here, we are looking for its computed value.
 * @param {string} id The name of the identifier.
 * @param {import('@chialab/estransform').Program} program The ast program.
 * @return {import('@chialab/estransform').StringLiteral|import('@chialab/estransform').Identifier} The init ast node.
 */
export function findIdentifierValue(id, program) {
    const identifier = program.body
        .filter(
            /**
             * @param {*} child
             */
            (child) => child.type === 'VariableDeclaration'
        )
        .reduce(
            /**
             * @param {*[]} acc
             * @param {*} child
             */
            (acc, child) => [...acc, ...child.declarations], []
        )
        .filter(
            /**
             * @param {*} child
             */
            (child) => child.type === 'VariableDeclarator'
        )
        .find(
            /**
             * @param {*} child
             */
            (child) => child.id && child.id.type === 'Identifier' && child.id.name === id
        );

    return identifier.init;
}

/**
 * @param {import('@chialab/estransform').NewExpression|import('@chialab/estransform').MemberExpression} node The ast node.
 * @param {import('@chialab/estransform').Program} ast The ast program.
 * @return The path value.
 */
export function getMetaUrl(node, ast) {
    const callExp = /** @type {import('@chialab/estransform').CallExpression} */ (node.type === 'MemberExpression' ? node.object : node);
    if (callExp.type !== 'CallExpression' && !callExp.callee || callExp.callee.type !== 'Identifier' || callExp.callee.value !== 'URL') {
        return;
    }

    if (callExp.arguments.length !== 2) {
        return;
    }

    const firstArgExp = callExp.arguments[0] && callExp.arguments[0].expression;
    const arg1 = firstArgExp.type === 'Identifier' && findIdentifierValue(firstArgExp.value, ast) || firstArgExp;
    const arg2 = callExp.arguments[1] && callExp.arguments[1].expression;

    if (arg1.type !== 'StringLiteral' ||
        arg2.type !== 'MemberExpression') {
        return;
    }

    if (arg2.object.type !== 'MetaProperty' ||
        arg2.property.type !== 'Identifier' ||
        arg2.property.value !== 'url') {
        return;
    }

    return arg1.value;
}

/**
 * Instantiate a plugin that converts URL references into static import
 * in order to handle assets bundling.
 * @param {PluginOptions} [options]
 * @return An esbuild plugin.
 */
export default function({ resolve = defaultResolve } = {}) {
    /**
     * @type {import('esbuild').Plugin}
     */
    const plugin = {
        name: 'meta-url',
        async setup(build) {
            await setupPluginDependencies(getParentBuild(build) || build, plugin, [
                emitPlugin(),
            ]);

            const { sourcesContent } = build.initialOptions;

            build.onLoad({ filter: createFilter(build), namespace: 'file' }, async (args) => {
                /**
                 * @type {import('@chialab/estransform').Pipeline}
                 */
                const entry = args.pluginData || await getEntry(build, args.path);
                if (!entry.code.includes('import.meta.url') ||
                    !entry.code.includes('URL(')) {
                    return;
                }

                try {
                    await pipe(entry, {
                        source: path.basename(args.path),
                        sourcesContent,
                    }, async (data) => {
                        /**
                         * @type {{ [key: string]: string }}
                         */
                        const ids = {};

                        /**
                         * @type {Promise<void>[]}
                         */
                        const promises = [];

                        walk(data.ast, {
                            NewExpression(node) {
                                const value = getMetaUrl(node, data.ast);
                                if (typeof value !== 'string' || isUrl(value)) {
                                    return;
                                }

                                promises.push((async () => {
                                    const resolvedPath = await resolve(value, args.path);
                                    if (!ids[resolvedPath]) {
                                        const entryPoint = emitFileOrChunk(build, resolvedPath);
                                        const { identifier } = prependImportStatement(data, entryPoint, value);
                                        ids[resolvedPath] = identifier;
                                    }

                                    const { start, end } = getSpan(data.ast, node);
                                    console.log(data.ast.span.start, start, data.code.substring(start, end));
                                    data.magicCode.overwrite(start, end, `new URL(${ids[resolvedPath]}, ${getBaseUrl(build)})`);
                                })());
                            },
                        });

                        await Promise.all(promises);
                    });
                } catch (error) {
                    throw transformError(this.name, error);
                }

                return finalizeEntry(build, args.path);
            });
        },
    };

    return plugin;
}
