import polyfillLibrary from 'polyfill-library';

/** @typedef {Partial<import('polyfill-library').Config>} Config */

const DEFAULT_FEATURES = {
    'es6': {},
    'URL': {},
    'URL.prototype.toJSON': {},
    'URLSearchParams': {},
    'Promise': {},
    'Promise.prototype.finally': {},
    'fetch': {},
};

/**
 * Inject polyfill loader into another plugin.
 * This is useful in combination with the dev server legacy plugin.
 * @param {Config} config
 * @return {import('express').RequestHandler}
 */
export function polyfillMiddleware(config) {
    return async (req, res, next) => {
        if (res.getHeader('Content-Type') !== 'text/html') {
            return next();
        }

        const features = config.features || DEFAULT_FEATURES;
        if (!Object.keys(features).length) {
            return next();
        }

        const ua = req.headers['user-agent'];
        if (!ua) {
            return;
        }

        const consolePolyfill = 'console.log=console.log.bind(console);';
        const code = await polyfillLibrary.getPolyfillString({
            uaString: ua,
            ...config,
            features,
        });
        const body = /** @type {string} */ (res.body);
        if (body.includes('<head>')) {
            res.body = body.replace('<head>', () => `<head><script>${consolePolyfill}${code}</script>`);
        } else if (body.includes('<body>')) {
            res.body = body.replace('<body>', () => `<body><script>${consolePolyfill}${code}</script>`);
        } else {
            res.body = `<script>${consolePolyfill}${code}</script>${body}`;
        }

        return next();
    };
}

/**
 * @param {Config} config
 */
export function polyfillPlugin(config = {}) {
    /**
     * @type {import('@chialab/es-dev-server').Plugin}
     */
    const plugin = (server) => {
        server.app.use(polyfillMiddleware(config));
    };

    return plugin;
}
