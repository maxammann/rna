import { writeDevEntrypointsJson } from '@chialab/rna-bundler';

/**
 * @param {import('@chialab/rna-config-loader').Entrypoint[]} [entrypoints]
 */
export function entrypointsPlugin(entrypoints = []) {
    /**
     * @type {import('@chialab/es-dev-server').Plugin}
     */
    const plugin = (server) => {
        if (!entrypoints) {
            return;
        }

        server.on('start', async () => {
            await Promise.all(
                entrypoints.map(async ({ input, entrypointsPath }) => {
                    if (!entrypointsPath) {
                        return;
                    }

                    const files = Array.isArray(input) ? input : [input];
                    await writeDevEntrypointsJson(files, entrypointsPath, server, 'esm');
                })
            );
        });
    };

    return plugin;
}
