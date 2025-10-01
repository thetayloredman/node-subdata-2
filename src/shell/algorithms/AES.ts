/*
 * node-subdata-2 - SubData 2 client for Node.js
 * Copyright (C) 2022, 2023  LogN
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as crypto from "crypto";
import debug from "debug";

import type ShellAlgorithm from "./ShellAlgorithm";

const log = debug("node-subdata-2:shell:algorithms:AES");

// AES specification constants
const CIPHER_MODE = "cbc";

// Key derivation specification
const KEYGEN_SPEC = "sha256";
const SALT_LENGTH = 16; // in bytes
const AUTH_KEY_LENGTH = 8; // in bytes
const ITERATIONS = 32768;
const IV_LENGTH = 16; // in bytes

/**
 * A class to perform password-based AES encryption and decryption in CBC mode.
 * 128, 192, and 256-bit encryption are supported.
 *
 * This is a TypeScript port of the Java AES implementation from SubData 2.
 */
export default class AESShellAlgorithm implements ShellAlgorithm {
    private keyLength: number;
    private password: string;

    /**
     * Initialize AES Cipher
     *
     * @param keyLength 128, 192, or 256 bit mode
     * @param password Password for encryption/decryption
     */
    public constructor(keyLength: number, password: string) {
        if (keyLength !== 128 && keyLength !== 192 && keyLength !== 256) throw new Error(`Invalid AES key length: ${keyLength}`);
        this.keyLength = keyLength;
        this.password = password;
        log(`initialized with ${keyLength}-bit encryption`);
    }

    /**
     * Derive encryption and authentication keys from password and salt using PBKDF2
     */
    private deriveKeys(salt: Buffer): { encryptionKey: Buffer; authenticationKey: Buffer } {
        // Derive a longer key, then split into AES key and authentication key
        const totalKeyLength = this.keyLength / 8 + AUTH_KEY_LENGTH;
        const fullKey = crypto.pbkdf2Sync(this.password, salt, ITERATIONS, totalKeyLength, KEYGEN_SPEC);

        // Split the key: first AUTH_KEY_LENGTH bytes for authentication, rest for encryption
        const authenticationKey = fullKey.subarray(0, AUTH_KEY_LENGTH);
        const encryptionKey = fullKey.subarray(AUTH_KEY_LENGTH);

        return { encryptionKey, authenticationKey };
    }

    /**
     * Encode (encrypt) data into a packet
     */
    public encode(data: Buffer): Buffer {
        log("encoding data of length", data.length);

        // Generate random salt
        const salt = crypto.randomBytes(SALT_LENGTH);

        // Derive keys
        const { encryptionKey, authenticationKey } = this.deriveKeys(salt);

        // Create cipher with random IV
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipherSpec = `aes-${this.keyLength}-${CIPHER_MODE}`;
        const cipher = crypto.createCipheriv(cipherSpec, encryptionKey, iv);

        // Encrypt the data
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

        // Build the output: keyLength(1) + salt(16) + authKey(8) + iv(16) + encrypted data
        const header = Buffer.allocUnsafe(1 + SALT_LENGTH + AUTH_KEY_LENGTH + IV_LENGTH);
        let offset = 0;

        // Write key length in bytes
        header.writeUInt8(this.keyLength / 8, offset);
        offset += 1;

        // Write salt
        salt.copy(header, offset);
        offset += SALT_LENGTH;

        // Write authentication key
        authenticationKey.copy(header, offset);
        offset += AUTH_KEY_LENGTH;

        // Write IV
        iv.copy(header, offset);

        const result = Buffer.concat([header, encrypted]);
        log("encoded to length", result.length);
        return result;
    }

    /**
     * Decode (decrypt) a packet into data
     */
    public decode(packet: Buffer): Buffer {
        log("decoding packet of length", packet.length);

        let offset = 0;

        // Read key length
        const keyLengthBytes = packet.readUInt8(offset);
        offset += 1;
        const keyLength = keyLengthBytes * 8;

        // Validate key length
        if (keyLength !== 128 && keyLength !== 192 && keyLength !== 256) throw new Error("Invalid AES stream: invalid key length");

        // Read salt
        const salt = packet.subarray(offset, offset + SALT_LENGTH);
        offset += SALT_LENGTH;

        // Derive keys
        const { encryptionKey, authenticationKey } = this.deriveKeys(salt);

        // Read and verify authentication key
        const authRead = packet.subarray(offset, offset + AUTH_KEY_LENGTH);
        offset += AUTH_KEY_LENGTH;

        if (!authenticationKey.equals(authRead)) throw new Error("Invalid password");

        // Read IV
        const iv = packet.subarray(offset, offset + IV_LENGTH);
        offset += IV_LENGTH;

        // Decrypt the data
        const encryptedData = packet.subarray(offset);
        const cipherSpec = `aes-${this.keyLength}-${CIPHER_MODE}`;
        const decipher = crypto.createDecipheriv(cipherSpec, encryptionKey, iv);

        const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);

        log("decoded to length", decrypted.length);
        return decrypted;
    }
}
