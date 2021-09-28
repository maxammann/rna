import path from 'path';
import { transformLoaders } from './loaders.js';

/**
 * @typedef {import('esbuild').TransformResult} TransformResult
 */

/**
 * @param {import('@chialab/rna-config-loader').Config} config
 * @param {import('esbuild').Plugin[]} extraPlugins
 * @param {import('esbuild').Plugin[]} extraTransformPlugins
 */
export async function createTransformOptions(config, extraPlugins = [], extraTransformPlugins = []) {
    const {
        root = process.cwd(),
        format,
        platform,
        target,
        sourcemap,
        minify,
        define,
        jsxFactory,
        jsxFragment,
        jsxModule,
        jsxExport,
        plugins = [],
        transformPlugins = [],
        logLevel,
    } = config;

    const finalPlugins = await Promise.all([
        import('@chialab/esbuild-plugin-env')
            .then(({ default: plugin }) => plugin()),
        import('@chialab/esbuild-plugin-define-this')
            .then(({ default: plugin }) => plugin()),
        import('@chialab/esbuild-plugin-jsx-import')
            .then(({ default: plugin }) => plugin({ jsxModule, jsxExport })),
        import('@chialab/esbuild-plugin-bundle-dependencies')
            .then(({ default: plugin }) => plugin({
                dependencies: false,
                peerDependencies: false,
                optionalDependencies: false,
            })),
        ...plugins,
        ...extraPlugins,
        import('@chialab/esbuild-plugin-transform')
            .then(async ({ default: plugin }) =>
                plugin([
                    ...transformPlugins,
                    ...extraTransformPlugins,
                ])
            ),
    ]);

    return {
        bundle: false,
        target,
        platform,
        sourcemap,
        minify,
        format,
        define,
        jsxFactory,
        jsxFragment,
        loader: transformLoaders,
        preserveSymlinks: true,
        sourcesContent: true,
        absWorkingDir: path.resolve(root),
        plugins: finalPlugins,
        logLevel,
    };
}

/**
 * Build and bundle sources.
 * @param {import('@chialab/rna-config-loader').EntrypointFinalConfig} config
 * @return {Promise<TransformResult>} The esbuild bundle result.
 */
export async function transform(config) {
    const { default: esbuild } = await import('esbuild');

    const {
        input,
        code,
        root,
        loader,
        globalName,
    } = config;

    if (code == null) {
        throw new Error('Missing required `code` option');
    }

    if (!code) {
        return { code: '', map: '', warnings: [] };
    }

    const sourceFile = path.resolve(root, Array.isArray(input) ? input[0] : input);
    const { outputFiles, warnings } = await esbuild.build({
        ...(await createTransformOptions(config)),
        stdin: {
            contents: code,
            loader,
            resolveDir: root,
            sourcefile: sourceFile,
        },
        globalName,
        write: false,
    });

    if (!outputFiles) {
        throw new Error(`Failed to transform "${input}"`);
    }

    return {
        code: outputFiles[0].text,
        map: outputFiles[1] ? outputFiles[1].text : '',
        warnings,
    };
}
