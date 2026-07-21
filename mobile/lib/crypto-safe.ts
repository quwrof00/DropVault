import { Platform } from "react-native";
import "react-native-get-random-values";
import "text-encoding-polyfill";
import { base64ToUint8Array } from "./base64";

const strToBuf = (str: string) => new TextEncoder().encode(str);
const bufToStr = (buf: ArrayBuffer | Uint8Array) => new TextDecoder().decode(buf);

let forgeRef: any = null;
const getForge = () => {
    if (!forgeRef) {
        forgeRef = require("node-forge");
    }
    return forgeRef;
};

// Robust pure JS Base64 encoder for binary data array
export const bytesToBase64 = (bytes: Uint8Array): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let base64 = "";
    for (let i = 0; i < bytes.length; i += 3) {
        base64 += chars[bytes[i] >> 2];
        base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
        base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
        base64 += chars[bytes[i + 2] & 63];
    }
    if ((bytes.length % 3) === 2) {
        base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (bytes.length % 3 === 1) {
        base64 = base64.substring(0, base64.length - 2) + "==";
    }
    return base64;
};

export const base64ToBytes = (b64: string): Uint8Array => {
    return base64ToUint8Array(b64);
};

let subtleProvider: any = null;
let randomProvider: any = null;

if (Platform.OS === "web") {
    subtleProvider = window.crypto.subtle;
    randomProvider = (array: Uint8Array) => window.crypto.getRandomValues(array);
} else {
    try {
        const QuickCrypto = require("react-native-quick-crypto").default || require("react-native-quick-crypto");
        subtleProvider = QuickCrypto.webcrypto.subtle;
        randomProvider = QuickCrypto.getRandomValues;
    } catch (e) {
        console.warn("Using node-forge fallback due to QuickCrypto unavailable:", e);
    }
}

const deriveNodeForgeKeyAsync = (keyString: string, salt: Uint8Array): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Break up task so UI doesn't completely freeze in JS thread
        setTimeout(() => {
            try {
                const forge = getForge();
                const key = forge.pkcs5.pbkdf2(
                    keyString,
                    forge.util.binary.raw.encode(salt),
                    150000,
                    32,
                    forge.md.sha256.create()
                );
                resolve(key);
            } catch(e) {
                reject(e);
            }
        }, 10);
    });
};

export async function encrypt(text: string, keyString: string) {
    if (subtleProvider) {
        const keyMaterial = await subtleProvider.importKey("raw", strToBuf(keyString), { name: "PBKDF2" }, false, ["deriveKey"]);
        const salt = new Uint8Array(16);
        randomProvider ? randomProvider(salt) : window.crypto.getRandomValues(salt);
        const key = await subtleProvider.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
        const iv = new Uint8Array(12);
        randomProvider ? randomProvider(iv) : window.crypto.getRandomValues(iv);
        const ciphertextBuffer = await subtleProvider.encrypt({ name: "AES-GCM", iv }, key, strToBuf(text));
        
        return {
            ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
            iv: bytesToBase64(iv),
            salt: bytesToBase64(salt),
        };
    }

    // Node-Forge Fallback Path (slower, pure JS)
    const forge = getForge();
    const cryptoApi = globalThis.crypto as Crypto;
    const salt = new Uint8Array(16);
    cryptoApi.getRandomValues(salt);
    const iv = new Uint8Array(12);
    cryptoApi.getRandomValues(iv);

    const key = await deriveNodeForgeKeyAsync(keyString, salt);

    const cipher = forge.cipher.createCipher("AES-GCM", key);
    cipher.start({
        iv: forge.util.binary.raw.encode(iv),
        tagLength: 128,
    });
    cipher.update(forge.util.createBuffer(text, "utf8"));
    
    if (!cipher.finish()) {
        throw new Error("Failed to encrypt note");
    }

    const encryptedBytes = forge.util.binary.raw.decode(cipher.output.getBytes());
    const tagBytes = forge.util.binary.raw.decode(cipher.mode.tag.getBytes());
    const combined = new Uint8Array(encryptedBytes.length + tagBytes.length);
    combined.set(encryptedBytes, 0);
    combined.set(tagBytes, encryptedBytes.length);

    return {
        ciphertext: bytesToBase64(combined),
        iv: bytesToBase64(iv),
        salt: bytesToBase64(salt),
    };
}

export async function decrypt(
    encrypted: { ciphertext: string; iv: string; salt: string },
    keyString: string
) {
    const { ciphertext, iv, salt } = encrypted;
    
    if (subtleProvider) {
        const keyMaterial = await subtleProvider.importKey("raw", strToBuf(keyString), { name: "PBKDF2" }, false, ["deriveKey"]);
        const derivedKey = await subtleProvider.deriveKey({ name: "PBKDF2", salt: base64ToBytes(salt) as unknown as BufferSource, iterations: 150000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        const decryptedBuffer = await subtleProvider.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) as unknown as BufferSource }, derivedKey, base64ToBytes(ciphertext) as unknown as BufferSource);
        return bufToStr(new Uint8Array(decryptedBuffer));
    }

    // Node-Forge Fallback Path (slower, pure JS)
    const forge = getForge();
    const encryptedBytes = base64ToBytes(ciphertext);
    const ivBytes = base64ToBytes(iv);
    const saltBytes = base64ToBytes(salt);

    if (encryptedBytes.length < 16) {
        throw new Error("Invalid encrypted note payload");
    }

    const key = await deriveNodeForgeKeyAsync(keyString, saltBytes);

    const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16);
    const cipherBytes = encryptedBytes.slice(0, encryptedBytes.length - 16);

    const decipher = forge.cipher.createDecipher("AES-GCM", key);
    decipher.start({
        iv: forge.util.binary.raw.encode(ivBytes),
        tagLength: 128,
        tag: forge.util.createBuffer(forge.util.binary.raw.encode(tagBytes)),
    });
    decipher.update(
        forge.util.createBuffer(forge.util.binary.raw.encode(cipherBytes))
    );

    if (!decipher.finish()) {
        throw new Error("Failed to decrypt note");
    }

    return decipher.output.toString("utf8");
}
