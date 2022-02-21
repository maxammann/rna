import { convertCssToJsModule, isCssModuleRequest } from '../helpers.js';

/**
 * Handle CSS requests as JS modules.
 * @return {import('express').RequestHandler}
 */
export const cssModules = () => (req, res, next) => {
    if (!isCssModuleRequest(req.url)) {
        return next();
    }

    res.setHeader('Content-Type', 'text/javascript');
    res.end(convertCssToJsModule(req.url));
};
