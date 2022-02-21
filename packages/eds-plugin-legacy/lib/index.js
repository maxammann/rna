import { createRequire } from 'module';
import { inject } from '@chialab/wds-plugin-polyfill';
import { createHelperUrl } from '@chialab/wds-plugin-node-resolve';
import { checkEsmSupport } from './checkEsmSupport.js';
import { readFile } from './readFile.js';
import { transform } from './transform.js';
import * as cheerio from 'cheerio';

const require = createRequire(import.meta.url);

/**
 * Cheerio esm support is unstable for some Node versions.
 */
const load = /** @type {typeof cheerio.load} */ (cheerio.load || cheerio.default?.load);

/**
 * Convert esm modules to the SystemJS module format.
 * It also transpiles source code using babel.
 * @param {import('@chialab/wds-plugin-polyfill').Config} config
 */
export function legacyPlugin(config = {}) {
    const systemUrl = require.resolve('systemjs/dist/s.min.js');
    const systemHelper = createHelperUrl('system.js');
    const regeneratorUrl = require.resolve('regenerator-runtime/runtime.js');
    const regeneratorHelper = createHelperUrl('runtime.js');

    /**
     * @type {Map<string, string>}
     */
    const inlineScripts = new Map();

    /**
     * @type {import('@chialab/es-dev-server').Plugin}
     */
    const plugin = (server) => {
        server.app.use(async (req, res, next) => {
            const pathname = new URL(req.url).pathname;

            if (inlineScripts.has(pathname)) {
                res.send(inlineScripts.get(pathname));
            }
            if (pathname === systemHelper) {
                res.send(await readFile(systemUrl));
            }
            if (pathname === regeneratorHelper) {
                res.send(await readFile(regeneratorUrl));
            }

            next();
        });

        async transform(context) {
            const ua = context.get('user-agent');
            if (checkEsmSupport(ua)) {
                return;
            }
            if (context.path === systemHelper ||
                context.path === regeneratorHelper) {
                return;
            }
            if (context.response.is('js')) {
                const body = /** @type {string} */ (context.body);
                context.body = await transform(body, context.url);
                return;
            }
            if (context.response.is('html')) {
                const body = /** @type {string} */ (context.body);
                const $ = load(body);
                const root = $.root();

                const scripts = root.find('script[type="module"]');
                for (let i = 0; i < scripts.length; i++) {
                    const $script = $(scripts[i]);
                    $script.removeAttr('type');
                    $script.attr('defer', '');
                    $script.attr('async', '');
                    if ($script.attr('src')) {
                        const src = $script.attr('src');
                        if (!src) {
                            continue;
                        }
                        const url = new URL(src, 'http://localhost');
                        if (url.host !== 'localhost') {
                            continue;
                        }
                        $script.removeAttr('src');
                        $script.text(`window.import('${src}');`);
                    } else {
                        const content = $script.html() || '';
                        const src = `/script-${inlineScripts.size}.js`;
                        inlineScripts.set(src, content);
                        $script.text(`window.import('${src}');`);
                    }
                }

                const head = root.find('head') || root.find('body');
                head.prepend('<script>(function() { var p = Promise.resolve(); window.import = function(source) { return p = p.then(function() { return System.import(source) }); }}());</script>');
                head.prepend(`<script src="${systemHelper}"></script>`);
                head.prepend(`<script src="${regeneratorHelper}"></script>`);

                context.body = $.html();
            }
        },
    };

    inject(plugin, config);

    return plugin;
}
