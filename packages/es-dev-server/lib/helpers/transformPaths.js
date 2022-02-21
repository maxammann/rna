import path from 'path';

/**
 * Transform dev server URLs to file paths.
 * @param {string} url The file url.
 * @param {string} root The dev server root.
 * @return {string} The file path.
 */
export const urlToPath = (url, root) => {
    const pathname = new URL(url).pathname.replace(/\^\//g, '../');

    return path.resolve(root, pathname);
};

/**
 * Transform paths to dev server URLs.
 * @param {string} filePath The file path.
 * @param {string} root The dev server root.
 * @return {string} The dev server URL.
 */
export const pathToUrl = (filePath, root) => {
    const relativePath = path.relative(root, filePath);

    return `/${relativePath.replace(/\.\.\//g, '^/')}`;
};
