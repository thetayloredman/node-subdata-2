/*
 * node-subdata-2 - SubData 2 wrapper for Node.js
 * Copyright (C) 2022  LogN
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

import SafeEventEmitter from "../lib/SafeEventEmitter";

export type StreamEvents = {
    /** Emitted when the stream is reset. */
    reset: [];
};

/** Represents the SubData stream (layer 1) */
export default class Stream extends SafeEventEmitter<StreamEvents> {
    /** The buffer of the stream */
    private _buffer: Buffer;
    /** The size of the buffer */
    private _bufferSize: number;

    public constructor() {
        super();
        this._buffer = Buffer.alloc(0);
        this._bufferSize = 0;
    }

    /**
     * Feed new data to this Stream.
     * @param data The data to feed
     */
    public feed(data: Buffer): void {
        this._buffer = Buffer.concat([this._buffer, data]);
        this._bufferSize += data.length;
    }

    /**
     * Reset the stored data.
     */
    private _readReset(): void {
        this._buffer = Buffer.alloc(0);
        this._bufferSize = 0;
        this.emit("reset");
    }
}
