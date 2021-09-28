/**
 * @param {import('express').Response} response
 * @param {(data: string, encoding: string) => Promise<string|void>|string|void} transformer
 */
export function transformResponse(response, transformer) {
    const originalWrite = response.write.bind(response);

    /**
     * @param {*} chunk
     * @param {BufferEncoding|((error: Error | null | undefined) => void)} [encoding]
     * @param {((error: Error | null | undefined) => void)} [callback]
     * @return {boolean}
     */
    function writer(chunk, encoding, callback) {
        if (response.writableEnded) {
            return false;
        }

        const computedEncoding = typeof encoding === 'string' ? encoding : 'utf-8';

        Promise.resolve()
            .then(() => (response.statusCode >= 400 ? chunk : transformer(chunk, computedEncoding)))
            .then((newChunk) => newChunk || chunk)
            .then((newChunk) => {
                originalWrite(newChunk, computedEncoding, callback);
            })
            .catch((err) => {
                response
                    .status(500)
                    .set('content-language', 'en')
                    .json({ message: err instanceof Error ? err.message : err })
                    .end();
            });

        return false;
    }

    response.write = writer;
}
