import { decrypt } from "../lib/crypto-helper";

self.onmessage = async (e: MessageEvent) => {
    const { notes, secretKey } = e.data;

    // Validate input
    if (!Array.isArray(notes) || !secretKey) {
        self.postMessage({ type: 'error', error: 'Invalid input data' });
        return;
    }

    const total = notes.length;
    let processed = 0;
    const BATCH_SIZE = 20;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = notes.slice(i, i + BATCH_SIZE);

        // Process batch in parallel
        const results = await Promise.all(batch.map(async (note: any) => {
            const { title, ciphertext, iv, salt } = note;
            try {
                let content = "";
                if (ciphertext && iv && salt) {
                    content = await decrypt({ ciphertext, iv, salt }, secretKey);
                }
                return { title, content };
            } catch (err) {
                console.error(`Worker failed to decrypt ${title}:`, err);
                return { title, content: "[Decryption Failed]" };
            }
        }));

        processed += results.length;

        // Post the batch back
        self.postMessage({
            type: 'batch',
            payload: results,
            progress: processed / total
        });
    }

    self.postMessage({ type: 'done' });
};
