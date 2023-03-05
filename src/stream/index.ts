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

import type { Duplex } from "node:stream";

import debug from "debug";
import { Emitter } from "strict-event-emitter";

import { endStream, writeTo } from "../lib/promisifiedStreamHelpers";
import { ControlCharacters } from "./controlCharacters";
import DirectStream, { DirectStreamEvents } from "./DirectStream";

const log = debug("node-subdata-2:stream");

export enum StreamEvents {
    Read = "read",
    Packet = "packet",
    Reset = "reset",
    /**
     * @deprecated The Close event is deprecated and will be removed in a future release. Use the End event instead.
     */
    Close = "close",
    End = "end"
}

export type StreamEventArguments = {
    /**
     * Fired when new data is received over the connection. You probably want `Packet` instead.
     */
    [StreamEvents.Read]: [Buffer];
    /**
     * Fired whenever an End Of Packet is received, with two parameters, size and data.
     */
    [StreamEvents.Packet]: [Buffer];
    /**
     * Fired whenever the remote sends Read Reset.
     */
    [StreamEvents.Reset]: [];
    /**
     * Fired when the connection is closing.
     * @deprecated The Close event is deprecated and will be removed in a future release. Use the End event instead.
     */
    // TODO: Remove this in a future release
    // eslint-disable-next-line deprecation/deprecation
    [StreamEvents.Close]: [];
    /**
     * Fired when the underlying Duplex triggers the 'end' event.
     */
    [StreamEvents.End]: [];
};

/**
 * Represents the SubData 2 {@link https://github.com/ME1312/SubData-2/wiki/Protocol-Format#layer-1-the-stream Layer 1 Stream}.
 *
 * This class provides a variety of methods for transmitting and receiving data and is mostly responsible for controlling
 * the usage of control characters throughout the data transmitted. SubData 2 is always TCP, however, there is a concept
 * of "providers" allowing you to use the SubData protocol (and this library) over another type of connection.
 */
export default class Stream extends Emitter<StreamEventArguments> {
    /** The underlying socket that is serving this Stream */
    private _socket: Duplex;
    /** The underlying DirectStream, responsible for encoding */
    private _stream: DirectStream;

    /**
     * Create a new Stream.
     * @param socket A network socket to use
     */
    public constructor(socket: Duplex) {
        super();
        log("initializing");
        this._socket = socket;
        this._stream = new DirectStream();
        this._socket.on("data", (data) => {
            log("feeding data", data);
            this._stream.feed(data);
        });
        this._stream.on(DirectStreamEvents.ReadReset, () => {
            log("forwarding reset");
            this.emit(StreamEvents.Reset);
        });
        this._stream.on(DirectStreamEvents.Read, (_size, _count, data) => {
            log("forwarding read", data);
            this.emit(StreamEvents.Read, data instanceof Buffer ? data : Buffer.from([data]));
        });
        this._stream.on(DirectStreamEvents.Packet, (data) => {
            log("forwarding packet", data);
            this.emit(StreamEvents.Packet, data);
        });
        this._socket.on("end", () => {
            log("forwarding close");
            // TODO: Remove this in a future release
            // eslint-disable-next-line deprecation/deprecation
            this.emit(StreamEvents.Close);
            this.emit(StreamEvents.End);
        });
    }

    /**
     * Write and encode data to send to the provider
     * Note: You probably want {@link Stream.writePacket} instead.
     * @param data The data to write
     */
    public async write(data: Buffer): Promise<void> {
        log("writing", data);
        return writeTo(this._socket, this._stream.encode(data));
    }

    /**
     * Terminates the current packet.
     * Note: This is often easier performed in one write via {@link Stream.writePacket}.
     */
    public async endPacket(): Promise<void> {
        log("ending packet");

        return writeTo(this._socket, Buffer.from([ControlCharacters.EndOfPacket]));
    }

    /**
     * Write data and end the current packet. This is equivalent to calling {@link Stream.write} and {@link Stream.endPacket} in sequence,
     * however, this will send both in one single transmission, which is probably marginally more efficient.
     */
    public async writePacket(data: Buffer): Promise<void> {
        log("writing packet of", data);
        return writeTo(this._socket, Buffer.concat([this._stream.encode(data), Buffer.from([ControlCharacters.EndOfPacket])]));
    }

    /**
     * Trigger a read reset and tell the remote server to discard all data.
     */
    public async readReset(): Promise<void> {
        log("triggering read reset");
        return writeTo(this._socket, Buffer.from([ControlCharacters.ReadReset]));
    }

    /**
     * Close the connection
     */
    public async close(): Promise<void> {
        log("triggering close");
        return endStream(this._socket);
    }
}
