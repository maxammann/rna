import { request } from 'http';

/**
 * @param {{ hostname: string, port: number }} options
 */
export function createEsbuildProxy({ hostname, port }) {
    /**
     * @type {import('express').RequestHandler}
     */
    return (req, res) => {
        const options = {
            hostname,
            port,
            path: req.url,
            method: req.method,
            headers: req.headers,
        };

        const proxyReq = request(options, (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 0, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
        });

        req.pipe(proxyReq, { end: true });
    };
}
