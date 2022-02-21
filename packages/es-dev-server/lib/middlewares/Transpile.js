/**
 * Create an esbuild based transpile middleware.
 * @param {import('esbuild').TransformOptions} [config]
 * @return {import('express').RequestHandler}
 */
export const transpile = (config = {}) => {
    const loaders = config.loader || {
        '.js': 'js',
        '.jsx': 'jsx',
        '.ts': 'ts',
        '.tsx': 'tsx',
    };

    return (req) => {

    };
};
