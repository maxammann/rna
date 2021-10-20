import Mocha from 'mocha';
import chai from 'chai';
import chaiAxe from './a11y.js';
import chaiDom from 'chai-dom';
import chaiSinon from 'sinon-chai';
import userEvent from '@testing-library/user-event';

chai.use(chaiAxe);
chai.use(chaiDom);
chai.use(chaiSinon);
if (typeof window !== 'undefined') {
    const document = window.document;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('mocha/mocha.css', import.meta.url).href;
    document.head.appendChild(link);
}

export { Mocha, chai, userEvent };
export const { assert, expect, should } = chai;
export * from './WSReporter.js';

/**
 * @param {import('mocha').MochaOptions} options
 * @param {string[]} files
 */
export async function run(options = {}, files = []) {
    const mocha = new Mocha({
        ui: 'bdd',
        ...options,
    });

    mocha.checkLeaks();

    await Promise.all(
        files.map((file) => import(file))
    );

    return await new Promise((resolve, reject) => {
        mocha.run((failures) => {
            if (failures) {
                reject(failures);
            } else {
                resolve(0);
            }
        });
    });
}
