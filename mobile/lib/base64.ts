const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function base64ToUint8Array(base64: string) {
    const cleaned = base64.replace(/\s/g, "");
    const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
    const byteLength = (cleaned.length * 3) / 4 - padding;
    const bytes = new Uint8Array(byteLength);

    let byteIndex = 0;

    for (let i = 0; i < cleaned.length; i += 4) {
        const encoded1 = BASE64_CHARS.indexOf(cleaned[i] || "A");
        const encoded2 = BASE64_CHARS.indexOf(cleaned[i + 1] || "A");
        const encoded3 = cleaned[i + 2] === "=" ? 64 : BASE64_CHARS.indexOf(cleaned[i + 2] || "A");
        const encoded4 = cleaned[i + 3] === "=" ? 64 : BASE64_CHARS.indexOf(cleaned[i + 3] || "A");

        const chunk =
            (encoded1 << 18) |
            (encoded2 << 12) |
            ((encoded3 & 63) << 6) |
            (encoded4 & 63);

        bytes[byteIndex++] = (chunk >> 16) & 255;

        if (encoded3 !== 64 && byteIndex < byteLength + 1) {
            bytes[byteIndex++] = (chunk >> 8) & 255;
        }

        if (encoded4 !== 64 && byteIndex < byteLength + 1) {
            bytes[byteIndex++] = chunk & 255;
        }
    }

    return bytes;
}
