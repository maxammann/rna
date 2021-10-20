import { runBrowserRunner } from './BrowserRunner.js';

export * from './Runner.js';
export * from './BrowserRunner.js';

/**
 * @param {import('commander').Command} program
 */
 export function command(program) {
    program
        .command('test:ginsenghino [specs...]')
        .action(
            /**
             * @param {string[]} specs
             */
            async (specs) => {
                const { serve } = await import('@chialab/rna-dev-server');

                const devServer = await serve({
                    rootDir: process.cwd(),
                });

                runBrowserRunner(devServer, {});
            }
        );
}
