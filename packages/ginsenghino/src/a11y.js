import axe from 'axe-core';

/**
 * @param {import('chai')} chai
 * @param {*} utils
 */
export default function(chai, utils) {
    const { Assertion, assert } = chai;

    utils.addMethod(Assertion.prototype, 'accessible', function() {
        /**
         * @type {import('axe-core').ElementContext}
         */
        const fixture = (/** @type {*} */ (this))._obj;

        /**
         * @type {import('axe-core').RunOptions}
         */
        const testOpts = {
            resultTypes: ['violations'],
        };

        const result = axe.run(fixture, testOpts)
            .then((results) => {
                const { violations } = results;
                if (!violations.length) {
                    return;
                }

                const messages = [];
                if (violations.length) {
                    messages.push('Accessibility Violations');
                    messages.push('---');
                    violations.forEach(violation => {
                        messages.push(`Rule: ${violation.id}`);
                        messages.push(`Impact: ${violation.impact}`);
                        messages.push(`${violation.help} (${violation.helpUrl})`);
                        violation.nodes.forEach(node => {
                            messages.push('');
                            if (node.target) {
                                messages.push(`Issue target: ${node.target}`);
                            }
                            messages.push(`Context: ${node.html}`);
                            if (node.failureSummary) {
                                messages.push(`${node.failureSummary}`);
                            }
                        });
                        messages.push('---');
                    });
                }

                return new Error(messages.join('\n'));
            });

        this.then = () => result;
        return this;
    });

    assert.isAccessible = function isAccessible(fixture, options) {
        return new Assertion(fixture).to.be.accessible(options);
    };

    assert.isNotAccessible = function isAccessible(fixture, options) {
        return new Assertion(fixture).not.to.be.accessible(options);
    };
}
