import { Platform } from "react-native";
import "text-encoding-polyfill";

// Native implementation using React Native Quick Crypto
const strToBuf = (str: string) => new TextEncoder().encode(str);
const bufToStr = (buf: ArrayBuffer) => new TextDecoder().decode(buf);

let subtle: any;
let getRandomValues: any;

if (Platform.OS === 'web') {
    subtle = window.crypto.subtle;
    getRandomValues = (array: Uint8Array) => window.crypto.getRandomValues(array);
} else {
    const QuickCrypto = require('react-native-quick-crypto').default;
    subtle = QuickCrypto.webcrypto.subtle;
    getRandomValues = QuickCrypto.getRandomValues;
}

export const base64ToBytes = (b64: string): Uint8Array => {
    // atob is available in React Native (via polyfill or engine) and Web
    const binString = atob(b64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0)!);
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
    // btoa is available in React Native (via polyfill or engine) and Web
    const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
    return btoa(binString);
};

export async function encrypt(text: string, keyString: string) {
    const keyMaterial = await subtle.importKey(
        "raw",
        strToBuf(keyString),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const salt = getRandomValues(new Uint8Array(16));

    const key = await subtle.deriveKey(
        {
            name: "PBKDF2",
            salt,
            iterations: 150000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    const iv = getRandomValues(new Uint8Array(12));

    const ciphertextBuffer = await subtle.encrypt(
        {
            name: "AES-GCM",
            iv,
        },
        key,
        strToBuf(text)
    );

    return {
        ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
        iv: bytesToBase64(iv),
        salt: bytesToBase64(salt),
    };
}

export async function decrypt(encrypted: any, keyString: string) {
    const { ciphertext, iv, salt } = encrypted;

    const keyMaterial = await subtle.importKey(
        "raw",
        strToBuf(keyString),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );

    const derivedKey = await subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: base64ToBytes(salt),
            iterations: 150000,
            hash: "SHA-256",
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    const decryptedBuffer = await subtle.decrypt(
        {
            name: "AES-GCM",
            iv: base64ToBytes(iv),
        },
        derivedKey,
        base64ToBytes(ciphertext)
    );

    return bufToStr(decryptedBuffer);
}
