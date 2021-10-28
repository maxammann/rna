import path from 'path';
import glob from 'fast-glob';
import { getSpan, pipe, walk } from '@chialab/estransform';
import { getEntry, finalizeEntry, createFilter, transformError } from '@chialab/esbuild-plugin-transform';

/**
 * Remove webpack features from sources.
 * @return An esbuild plugin.
 */
export default function() {
    /**
     * @type {import('esbuild').Plugin}
     */
    const plugin = {
        name: 'unwebpack',
        setup(build) {
            const { sourcesContent } = build.initialOptions;

            build.onLoad({ filter: createFilter(build), namespace: 'file' }, async (args) => {
                /**
                 * @type {import('@chialab/estransform').Pipeline}
                 */
                const entry = args.pluginData || await getEntry(build, args.path);
                if (!entry.code.includes('module.hot.decline') &&
                    !entry.code.includes('webpackInclude:')) {
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
                            CallExpression(node) {
                                if (node.callee.type !== 'Identifier' || node.callee.value !== 'import') {
                                    return;
                                }

                                const source = node.arguments[0] && node.arguments[0].expression;
                                if (source.type !== 'TemplateLiteral') {
                                    return;
                                }

                                /**
                                 * @type {string[]}
                                 */
                                const comments = (/** @type {*} */(node)).comments;
                                const included = comments.find((value) => value.startsWith('webpackInclude:'));
                                if (!included) {
                                    return;
                                }

                                const excluded = comments.find((value) => value.startsWith('webpackExclude:'));
                                const include = new RegExp(included.replace('webpackInclude:', '').trim().replace(/^\//, '').replace(/\/$/, ''));
                                const exclude = excluded && new RegExp(excluded.replace('webpackExclude:', '').trim().replace(/^\//, '').replace(/\/$/, ''));
                                const initial = source.quasis[0].raw.value;
                                const identifier = source.expressions[0].type === 'Identifier' && source.expressions[0].value;

                                promises.push((async () => {
                                    const map = (await glob(`${initial}*`, {
                                        cwd: path.dirname(args.path),
                                    }))
                                        .filter((name) => name.match(include) && (!exclude || !name.match(exclude)))
                                        .reduce((map, name) => {
                                            map[name.replace(include, '')] = `./${path.join(initial, name)}`;
                                            return map;
                                        }, /** @type {{ [key: string]: string }} */({}));

                                    const { start, end } = getSpan(data.ast, node);
                                    data.magicCode.overwrite(start, end, `({ ${Object.keys(map).map((key) => `'${key}': () => import('${map[key]}')`).join(', ')} })[${identifier}]()`);
                                })());
                            },

                            IfStatement(node) {
                                const testNode = node.test;
                                if (testNode.type !== 'BinaryExpression') {
                                    return;
                                }

                                if (testNode.left.type !== 'BinaryExpression' ||
                                    testNode.left.left.type !== 'Identifier' ||
                                    testNode.left.left.value !== 'module' ||
                                    testNode.left.right.type !== 'MemberExpression' ||
                                    testNode.left.right.object.type !== 'Identifier' ||
                                    testNode.left.right.object.value !== 'module' ||
                                    testNode.left.right.property.type !== 'Identifier' ||
                                    testNode.left.right.property.value !== 'hot' ||
                                    testNode.right.type !== 'MemberExpression' ||
                                    testNode.right.object.type !== 'MemberExpression' ||
                                    testNode.right.object.object.type !== 'Identifier' ||
                                    testNode.right.object.object.value !== 'module' ||
                                    testNode.right.object.property.type !== 'Identifier' ||
                                    testNode.right.object.property.value !== 'hot' ||
                                    testNode.right.property.type !== 'Identifier' ||
                                    testNode.right.property.value !== 'decline'
                                ) {
                                    return;
                                }

                                const { start, end } = getSpan(data.ast, node);
                                data.magicCode.overwrite(start, end, '');
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
