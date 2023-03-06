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

import { PassThrough } from "node:stream";

import debug from "debug";
import { Emitter } from "strict-event-emitter";

import Stream, { StreamEvents } from ".";
import type { ControlCharacters } from "./controlCharacters";
import { type SizedControlCharacters } from "./controlCharacters";

const log = debug("node-subdata-2:stream:DirectStream");

export enum DirectStreamEvents {
    ReadReset = "reset",
    Read = "read",
    Packet = "packet"
}

export type DirectStreamEventArguments = {
    /** Emitted when the stream is reset */
    [DirectStreamEvents.ReadReset]: [];
    /**
     * Emitted when the stream reads data.
     * This event may fire before the end of a packet.
     * Fires with three arguments, the size read in ControlCharacters, the number of that size read, and the data read.
     * ReadByte will return Number, the rest will return Buffer.
     */
    [DirectStreamEvents.Read]: [ControlCharacters.ReadByte, 1, number] | [SizedControlCharacters, number, Buffer];
    /** Emitted when an End of Packet is received along with (size, data) parameters. */
    [DirectStreamEvents.Packet]: [Buffer];
};

/**
 * Represents the {@link https://github.com/ME1312/SubData-2/wiki/Protocol-Format#layer-1-the-stream SubData Stream}.
 *
 * This Stream class is a wrapper around a buffer that handles the reading of packets.
 *
 * It emits a few events, which can be found in {@link DirectStreamEvents} and {@link DirectStreamEventArguments}.
 *
 * You can feed a Stream raw data with its {@link DirectStream.feed} method.
 *
 * This stream does not connect with an actual socket, it is just a wrapper around a buffer. You probably
 * want to use {@link Stream} for this purpose.
 *
 * @deprecated This class is deprecated and will be removed in a future version. The implementation from this class
 * has been moved to {@link Stream}.
 */
// TODO: Remove this class in a future release
export default class DirectStream extends Emitter<DirectStreamEventArguments> {
    private _stream: Stream;
    private _passThrough: PassThrough;

    public constructor() {
        super();
        log("initializing deprecated pass-through class");
        this._passThrough = new PassThrough();
        this._stream = new Stream(this._passThrough);
        this._stream.on(StreamEvents.Read, (data) => {
            this.emit(DirectStreamEvents.Read, data.length, Math.floor(data.length / 4), data);
        });
        this._stream.on(StreamEvents.Packet, (data) => {
            this.emit(DirectStreamEvents.Packet, data);
        });
        this._stream.on(StreamEvents.Reset, () => {
            this.emit(DirectStreamEvents.ReadReset);
        });
    }

    /**
     * Feed new data to this Stream.
     * @param data The data to feed
     */
    public feed(data: Buffer): void {
        this._passThrough.write(data);
    }

    /**
     * Encode a Buffer into Layer 1 stream data.
     * @param data The data to encode
     */
    public encode(input: Buffer): Buffer {
        return this._stream.encode(input);
    }
}
