<p align="center">
    <strong>Wds Plugin Legacy</strong> • Transform esm modules served by the <a href="https://modern-web.dev/docs/dev-server/overview/">Web Dev Server</a> into SystemJS modules for legacy browser compatibility.
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@chialab/eds-plugin-legacy"><img alt="NPM" src="https://img.shields.io/npm/v/@chialab/eds-plugin-legacy.svg?style=flat-square"></a>
</p>

---

## Install

```sh
$ npm i @chialab/eds-plugin-legacy -D
$ yarn add @chialab/eds-plugin-legacy -D
```

## Usage

```js
import { startDevServer } from '@web/dev-server';
import { legacyPlugin } from '@chialab/eds-plugin-legacy';

await startDevServer({
    plugins: [
        legacyPlugin(),
    ],
});
```

This is similar to the [official legacy plugin](https://www.npmjs.com/package/@web/dev-server-legacy), but with a different polyfill strategy.

---

## License

**Wds Plugin Legacy** is released under the [MIT](https://github.com/chialab/rna/blob/main/packages/eds-plugin-legacy/LICENSE) license.
