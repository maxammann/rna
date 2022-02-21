import { pathToUrl, urlToPath } from '@chialab/es-dev-server';
import { getSearchParams } from '@chialab/node-resolve';
import { convertFileToJsModule, isFileRequest } from '../helpers.js';

/**
 * Handle file requests as JS modules.
 * @param {string} root
 * @return {import('express').RequestHandler}
 */
export const fileModules = (root) => (req, res, next) => {
    if (!isFileRequest(req.url)) {
        return next();
    }

    const { path: pathname, searchParams } = getSearchParams(req.url);
    const filePath = pathToUrl(urlToPath(pathname, root), root);

    res.setHeader('Content-Type', 'text/javascript');
    res.end(convertFileToJsModule(`${filePath}?${searchParams.toString()}`));
};
