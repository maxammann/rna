/**
 * @typedef {Object} Logger
 * @property {(...messages: any[]) => void} log
 * @property {(...messages: any[]) => void} debug
 * @property {(...messages: any[]) => void} error
 * @property {(...messages: any[]) => void} warn
 * @property {() => void} group
 * @property {() => void} groupEnd
 */

/**
 * @type {Logger}
 */
export const logger = console;
