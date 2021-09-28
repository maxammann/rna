// import cheerio from 'cheerio';
// import { transformResponse } from './transformResponse.js';

// export function injectImportMaps() {
//     /**
//      * @type {import('express').RequestHandler}
//      */
//     return async (request, response, next) => {
//         await transformResponse(response, (data) => {
//             const $ = cheerio.load(data);
//             const script = $.load('script');
//             script.attr('type', 'importmap');
//             script.text(JSON.stringify({
//             "imports": {
//                 "app": "./src/app.js"
//             }
//             }));
//             $('head').append(script);

//             return $.html();
//         });

//         next();
//     };
// }
