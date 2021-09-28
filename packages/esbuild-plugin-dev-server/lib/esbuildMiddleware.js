import path from 'path';
import { access } from 'fs/promises';
import esbuild from 'esbuild';

/**
 * @param {esbuild.BuildOptions} options
 */
export function createEsbuildMiddleware(options, esbuildModule = esbuild) {
    const { loader: loaders = {}, sourceRoot, absWorkingDir } = options;
    const rootDir = sourceRoot || absWorkingDir || process.cwd();
    /**
     * @type {import('express').RequestHandler}
     */
    return async (req, res, next) => {
        const uri = req.url;
        const ext = path.posix.extname(uri);
        if (!(ext in loaders)) {
            return next();
        }

        const filePath = path.resolve(rootDir, req.url.replace(/^\/*/, ''));
        try {
            await access(filePath);
        } catch (err) {
            return next();
        }

        const result = await esbuildModule.build({
            ...options,
            entryPoints: [filePath],
            sourcemap: 'inline',
            write: false,
        });

        res.write(result.outputFiles[0].text);
        res.end();
    };
}
