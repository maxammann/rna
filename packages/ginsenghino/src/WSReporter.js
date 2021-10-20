import Mocha from 'mocha';

const {
    EVENT_RUN_BEGIN,
    EVENT_RUN_END,
    EVENT_TEST_FAIL,
    EVENT_TEST_PASS,
    EVENT_SUITE_BEGIN,
    EVENT_SUITE_END,
} = Mocha.Runner.constants;

export class WSReporter {
    /**
     * @param {import('mocha').Runner} runner
     */
    constructor(runner) {
        runner
            .on(EVENT_RUN_BEGIN, () => {
                console.log('start');
            })
            .on(EVENT_SUITE_BEGIN, () => {
                console.log('suite begin');
            })
            .on(EVENT_SUITE_END, () => {
                console.log('suite end');
            })
            .on(EVENT_TEST_PASS, (test) => {
                console.log('test pass', test);
            })
            .on(EVENT_TEST_FAIL, (test, err) => {
                console.log('test fail', test, err);
            })
            .once(EVENT_RUN_END, () => {
                console.log('end', runner.stats?.passes, runner.stats?.failures);
            });
    }
}
