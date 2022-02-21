<p align="center">
    <strong>Wds Plugin RNA</strong> • A plugin for the Web Dev Server to transpile sources using the RNA bundler.
</p>

<p align="center">
    <a href="https://www.npmjs.com/package/@chialab/eds-plugin-rna"><img alt="NPM" src="https://img.shields.io/npm/v/@chialab/eds-plugin-rna.svg?style=flat-square"></a>
</p>

---

## Install

```sh
$ npm i @chialab/eds-plugin-rna -D
$ yarn add @chialab/eds-plugin-rna -D
```

## Usage

```js
import { startDevServer } from '@web/dev-server';
import rnaPlugin from '@chialab/eds-plugin-rna';

await startDevServer({
    plugins: [
        rnaPlugin(),
    ],
});
```

---

## License

**Wds Plugin RNA** is released under the [MIT](https://github.com/chialab/rna/blob/main/packages/eds-plugin-rna/LICENSE) license.
