import { urlToPath } from '@chialab/es-dev-server';
import { build } from '@chialab/rna-bundler';
import { createConfig } from '../helpers.js';

/**
 * @typedef {(filePath: string; build: Promise<import('@chialab/esbuild-rna').Result>) => void} OnBuildCallback
 */

/**
 * Handle CSS requests as JS modules.
 * @param {string} root
 * @param {Partial<import('@chialab/rna-config-loader').CoreTransformConfig>} config
 * @param {OnBuildCallback} [onBuild]
 * @return {import('express').RequestHandler}
 */
export const cssBuild = (root, config, onBuild) => async (req, res, next) => {
    if (!req.accepts('text/css')) {
        return next();
    }

    const filePath = urlToPath(req.url, root);

    /**
     * @type {import('@chialab/rna-config-loader').Entrypoint}
     */
    const entrypoint = {
        root,
        input: filePath,
        output: filePath,
        loader: 'css',
        bundle: true,
    };

    const promise = createConfig(entrypoint, config)
        .then((transformConfig) =>
            build({
                ...transformConfig,
                entryNames: '[name]',
                assetNames: '[name]',
                chunkNames: '[name]',
                output: filePath,
                write: false,
            })
        );

    onBuild?.(filePath, promise);

    const result = await promise;
    const outputFiles = /** @type {import('esbuild').OutputFile[]} */ (result.outputFiles);
    res.setHeader('Content-Type', 'text/css');
    res.end(outputFiles[0].contents.toString());
};
