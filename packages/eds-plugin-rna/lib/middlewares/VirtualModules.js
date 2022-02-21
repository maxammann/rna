import { urlToPath } from '@chialab/es-dev-server';

/**
 * @typedef {{ [key: string]: Promise<Buffer> }} VirtualFS
 */

/**
 * Create a virtual fs.
 * @return {VirtualFS}
 */
export function createVirtualFS() {
    return {};
}

/**
 * Handle virtual modules request.
 * @param {string} root
 * @param {VirtualFS} virtualFs
 * @return {import('express').RequestHandler}
 */
export const virtualModules = (root, virtualFs) => async (req, res, next) => {
    const filePath = urlToPath(req.url, root);
    if (!(filePath in virtualFs)) {
        return next();
    }

    res.setHeader('Content-Type', 'text/javascript');
    res.end(await virtualFs[filePath]);
};
