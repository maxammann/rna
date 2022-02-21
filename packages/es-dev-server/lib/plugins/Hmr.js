import { urlToPath } from '../helpers/transformPaths.js';

/**
 * @typedef {Object} CSSResource
 * @property {string} url
 * @property {string[]} dependencies
 * @property {string[]} dependants
 */

/**
 * Handle CSS hmr.
 * @type {import('../DevServer.js').Plugin}
 */
const HmrCss = (server) => {
    const root = server.getRoot();

    /**
     * The css content-type header.
     */
    const CSS_CONTENT_TYPE = 'text/css';

    /**
     * @type {Map<string, CSSResource>}
     */
    const dependencyTree = new Map();

    const CSS_RELOAD_CODE = `export default function(entrypoints) {
    entrypoints.forEach(function(entrypoint) {
        const url = new URL(entrypoint);
        const links = Array.from(document.querySelectorAll('link'))
            .filter(function(elem) {
                const link = new URL(elem.href);
                return link.origin === url.origin && link.pathname === url.pathname;
            });
        if (links.length) {
            url.searchParams.set('ts', Date.now());
            for (let i = 0; i < links.length; i++) {
                links[i].setAttribute('href', url.href);
            }
        }
    });
}`.replace(/\n\s*/g, '');

    /**
     * @param {Map<string, CSSResource>} dependencyTree
     * @param {string} filePath
     * @param {string} url
     * @return {CSSResource}
     */
    const ensureResource = (dependencyTree, filePath, url) => {
        if (!dependencyTree.has(filePath)) {
            dependencyTree.set(filePath, {
                url,
                dependencies: [],
                dependants: [],
            });
        }

        return /** @type {CSSResource} */ (dependencyTree.get(filePath));
    };

    /**
     * @param {Map<string, CSSResource>} dependencyTree
     * @param {string} filePath
     * @return {CSSResource[]}
     */
    const invalidateResource = (dependencyTree, filePath) => {
        const resource = dependencyTree.get(filePath);
        if (!resource) {
            return [];
        }

        resource.dependencies.forEach((dependency) => {
            const dependencyResource = dependencyTree.get(dependency);
            if (!dependencyResource) {
                return;
            }

            dependencyResource.dependants.splice(dependencyResource.dependants.indexOf(filePath), 1);
            invalidateResource(dependencyTree, dependency);
        });

        if (!resource.dependants.length) {
            dependencyTree.delete(filePath);
            return [resource];
        }

        return resource.dependants.reduce(
            (acc, dependant) => [...acc, ...invalidateResource(dependencyTree, dependant)],
            /** @type {CSSResource[]} */([])
        );
    };

    /**
     * @type {import('../DevServer.js').ServeEventCallback}
     */
    const serveCallback = (filePath, req, res) => {
        if (res.headers.get('Content-Type') !== CSS_CONTENT_TYPE) {
            return;
        }

        const fileEntry = ensureResource(dependencyTree, filePath, req.url);
        const referer = res.headers.get('referer');
        if (!referer) {
            return;
        }

        const refererPath = urlToPath(new URL(referer).pathname, root);
        const referEntry = dependencyTree.get(refererPath);
        if (!referEntry) {
            return;
        }

        referEntry.dependencies.push(filePath);
        fileEntry.dependants.push(refererPath);
    };

    /**
     * @type {import('../DevServer.js').FileChangedEventCallback}
     */
    const changedCallback = (filePath, reload) => {
        if (!dependencyTree.has(filePath)) {
            return;
        }

        const entrypoints = invalidateResource(dependencyTree, filePath).map((entryPoint) => entryPoint.url);
        reload(entrypoints, `data:text/javascript,${CSS_RELOAD_CODE}`);
    };

    server.on('serve', serveCallback);
    server.on('fileChanged', changedCallback);
};

/**
 * Handle generic file hmr.
 * @type {import('../DevServer.js').Plugin}
 */
const HmrFile = (server) => {
    /**
     * @type {import('../DevServer.js').FileChangedEventCallback}
     */
    const changedCallback = (filePath, reload) => {
        reload([filePath], 'data:text/javascript,window.location.reload()');
    };

    server.on('fileChanged', changedCallback);
};

/**
 * @type {import('../DevServer.js').Plugin}
 */
export const Hmr = (server) => {
    HmrCss(server);
    HmrFile(server);
};
