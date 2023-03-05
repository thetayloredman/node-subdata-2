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

import type { Writable } from "stream";

// A variety of helper functions for working with streams in a promisified manner

/** Async version of Writable#write() */
export function writeTo(stream: Writable, chunk: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
        stream.write(chunk, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/** Async version of Writable#end() */
export function endStream(stream: Writable): Promise<void> {
    return new Promise((resolve) => {
        stream.end(resolve);
    });
}
