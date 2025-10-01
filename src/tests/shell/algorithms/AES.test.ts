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

import AESShellAlgorithm from "../../../shell/algorithms/AES";

describe("AESShellAlgorithm", () => {
    test("should throw error for invalid key lengths", () => {
        expect(() => new AESShellAlgorithm(64, "password")).toThrow("Invalid AES key length: 64");
        expect(() => new AESShellAlgorithm(512, "password")).toThrow("Invalid AES key length: 512");
    });

    test("should create instance with valid key lengths", () => {
        expect(() => new AESShellAlgorithm(128, "password")).not.toThrow();
        expect(() => new AESShellAlgorithm(192, "password")).not.toThrow();
        expect(() => new AESShellAlgorithm(256, "password")).not.toThrow();
    });

    test("should encrypt and decrypt data with 128-bit key", () => {
        const algorithm = new AESShellAlgorithm(128, "test-password");
        const data = Buffer.from("Hello, world!");
        const encrypted = algorithm.encode(data);
        expect(encrypted).not.toEqual(data);
        expect(encrypted.length).toBeGreaterThan(data.length);
        const decrypted = algorithm.decode(encrypted);
        expect(decrypted).toEqual(data);
    });

    test("should encrypt and decrypt data with 192-bit key", () => {
        const algorithm = new AESShellAlgorithm(192, "test-password");
        const data = Buffer.from("Hello, world!");
        const encrypted = algorithm.encode(data);
        expect(encrypted).not.toEqual(data);
        const decrypted = algorithm.decode(encrypted);
        expect(decrypted).toEqual(data);
    });

    test("should encrypt and decrypt data with 256-bit key", () => {
        const algorithm = new AESShellAlgorithm(256, "test-password");
        const data = Buffer.from("Hello, world!");
        const encrypted = algorithm.encode(data);
        expect(encrypted).not.toEqual(data);
        const decrypted = algorithm.decode(encrypted);
        expect(decrypted).toEqual(data);
    });

    test("should encrypt and decrypt large data", () => {
        const algorithm = new AESShellAlgorithm(256, "test-password");
        const data = Buffer.alloc(10000, "test");
        const encrypted = algorithm.encode(data);
        const decrypted = algorithm.decode(encrypted);
        expect(decrypted).toEqual(data);
    });

    test("should throw error when decrypting with wrong password", () => {
        const algorithm1 = new AESShellAlgorithm(128, "password1");
        const algorithm2 = new AESShellAlgorithm(128, "password2");
        const data = Buffer.from("Hello, world!");
        const encrypted = algorithm1.encode(data);
        expect(() => algorithm2.decode(encrypted)).toThrow("Invalid password");
    });

    test("should produce different ciphertexts for same plaintext", () => {
        const algorithm = new AESShellAlgorithm(128, "test-password");
        const data = Buffer.from("Hello, world!");
        const encrypted1 = algorithm.encode(data);
        const encrypted2 = algorithm.encode(data);
        // Should be different due to random IV and salt
        expect(encrypted1).not.toEqual(encrypted2);
        // But both should decrypt to the same data
        expect(algorithm.decode(encrypted1)).toEqual(data);
        expect(algorithm.decode(encrypted2)).toEqual(data);
    });

    test("should handle empty data", () => {
        const algorithm = new AESShellAlgorithm(128, "test-password");
        const data = Buffer.from("");
        const encrypted = algorithm.encode(data);
        const decrypted = algorithm.decode(encrypted);
        expect(decrypted).toEqual(data);
    });

    test("should throw error for invalid AES stream", () => {
        const algorithm = new AESShellAlgorithm(128, "test-password");
        const invalidPacket = Buffer.from([99, 1, 2, 3, 4, 5]); // Invalid key length
        expect(() => algorithm.decode(invalidPacket)).toThrow("Invalid AES stream");
    });
});
