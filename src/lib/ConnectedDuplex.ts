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

import { Duplex, PassThrough } from "node:stream";

/**
 * Two Duplex streams that pipe data to each-other, useful for testing.
 *
 * ```ts
 * const [a, b] = ConnectedDuplex.new();
 * a.write("Hello");
 * b.on("data", (data) => {
 *    console.log(data.toString()); // "Hello"
 * });
 * b.write("Hello2");
 * a.on("data", (data) => {
 *   console.log(data.toString()); // "Hello2"
 * });
 * ```
 * Use `ConnectedDuplex.new()` to create a new pair of streams. Do **not** use
 * `new ConnectedDuplex()` directly.
 */
export default class ConnectedDuplex extends Duplex {
    public _buffer: PassThrough = new PassThrough();
    // eslint-disable-next-line no-use-before-define
    public _other: ConnectedDuplex | undefined;

    /**
     * Do not use this directly, use `ConnectedDuplex.new()` instead.
     */
    public constructor() {
        super();

        this.once("finish", () => {
            if (!this._other)
                throw new Error("Incorrect usage of ConnectedDuplex detected -- use ConnectedDuplex.new() instead of new ConnectedDuplex()");

            this._other._buffer.end();
        });

        this._buffer.once("end", () => {
            this.push(null);
        });
    }

    public _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null | undefined) => void): void {
        if (!this._other)
            throw new Error("Incorrect usage of ConnectedDuplex detected -- use ConnectedDuplex.new() instead of new ConnectedDuplex()");

        this._other._buffer.write(chunk, encoding, callback);
    }

    public _read() {
        const chunk = this._buffer.read();
        if (chunk) this.push(chunk);
        else
            this._buffer.once("readable", () => {
                this._read();
            });
    }

    /**
     * Create a new pair of connected duplex streams. This is the only way to
     * create a new pair of streams, do not use `new ConnectedDuplex()` directly.
     * @returns A pair of connected duplex streams.
     */
    public static new(): [ConnectedDuplex, ConnectedDuplex] {
        const a = new ConnectedDuplex();
        const b = new ConnectedDuplex();
        a._other = b;
        b._other = a;
        return [a, b];
    }
}
