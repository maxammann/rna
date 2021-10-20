import { Runner } from './Runner.js';
import puppeteer from 'puppeteer-core';

/**
 * @typedef {Required<Parameters<typeof puppeteer.launch>>[0]} BrowserLauncher
 */

/**
 * @typedef {import('./Runner.js').RunnerOptions & { browsers?: BrowserLauncher[] }} BrowserRunnerOptions
 */

/**
 * @extends {Runner<BrowserRunnerOptions>}
 */
export class BrowserRunner extends Runner {
    /**
     * @param {import('@web/dev-server-core').DevServer} devServer
     */
    async run(devServer) {
        await super.run(devServer);

        const { browsers = [{}] } = this.options;
        const { address } = /** @type {import('net').AddressInfo} */ (devServer.server.address());

        await Promise.all(
            browsers.map((browser) => this.runBrowser(browser, address))
        );
    }

    /**
     * @param {BrowserLauncher} launchData
     * @param {string} address
     */
    async runBrowser(launchData, address) {
        const browser = await puppeteer.launch({
            ...launchData,
            headless: false,
            args: [
                '--no-sandbox',
                ...(launchData?.args || []),
            ],
        });
        const page = await browser.newPage();

        console.log(address);
        await page.goto(address);
    }
}

/**
 * @param {import('@web/dev-server-core').DevServer} devServer
 * @param {BrowserRunnerOptions} options
 */
export async function runBrowserRunner(devServer, options) {
    const runner = new BrowserRunner(options);
    await runner.run(devServer);

    return runner;
}
