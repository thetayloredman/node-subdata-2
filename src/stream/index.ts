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
import { bytes, kb, mb } from "../lib/sizeHelpers";
import type { SizedControlCharacters } from "./controlCharacters";
import { ControlCharacters } from "./controlCharacters";

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

    /** The buffer of the stream */
    private _buffer: Buffer;
    /** The size of the buffer */
    private _bufferSize: number;
    /** The buffer of the currently in-progress */
    private _packet: Buffer;
    /** The size of the currently in-progress packet */
    private _packetSize: number;

    /**
     * Create a new Stream.
     * @param socket A network socket to use
     */
    public constructor(socket: Duplex) {
        super();
        log("initializing");
        this._buffer = Buffer.alloc(0);
        this._bufferSize = 0;
        this._packet = Buffer.alloc(0);
        this._packetSize = 0;

        this._socket = socket;

        this._socket.on("data", (data) => {
            log("feeding data", data);
            this._feed(data);
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
     * Feed new data internally to this Stream. Called when new data is received
     * over the socket.
     * @param data The data to feed
     */
    private _feed(data: Buffer): void {
        log("feeding data", data, "size", data.length);
        this._buffer = Buffer.concat([this._buffer, data]);
        this._bufferSize += data.length;
        log("new data", this._buffer, "size", this._bufferSize);
        this._handleNewData();
    }

    /**
     * Invalidates all previous data. Called internally when a {@link ControlCharacters.ReadReset} is encountered.
     */
    private _readReset(): void {
        log("triggering read reset");
        this._buffer = Buffer.alloc(0);
        this._bufferSize = 0;
        this._packet = Buffer.alloc(0);
        this._packetSize = 0;
        this.emit(StreamEvents.Reset);
    }

    /**
     * Command the stream to attempt to process new data. Called internally after {@link DirectStream.feed} is called.
     */
    private _handleNewData(): void {
        if (this._bufferSize === 0) return;
        const char = this._buffer[0];

        if (!(char.toString() in ControlCharacters))
            throw new Error(`I don't know what I am looking at! Encountered unknown control character 0x${this._buffer[0].toString(16)} in stream.`);

        log("handling control character", ControlCharacters[char]);

        switch (this._buffer[0]) {
            case ControlCharacters.ReadReset:
                const postReset = this._buffer.subarray(1);
                log("triggering read reset, following data", postReset);
                this._readReset();
                // Re-insert all data that follows the reset
                log("re-feeding data");
                this._feed(postReset);
                break;
            case ControlCharacters.ReadByte:
                if (this._bufferSize < 2) return;
                this._emitRead({ controlCharacter: ControlCharacters.ReadByte, bytes: 1 }, this._buffer[1]);
                this._shiftBuffer(2);
                break;
            case ControlCharacters.ReadBytes:
                if (this._bufferSize < 2) return;
                const byteSize = (this._buffer[1] + 1) * 4;
                if (this._bufferSize < byteSize + 2) return;
                this._emitRead({ controlCharacter: ControlCharacters.ReadBytes, bytes: byteSize }, this._buffer.subarray(2, byteSize + 2));
                this._shiftBuffer(byteSize + 2);
                break;
            case ControlCharacters.ReadKB:
                if (this._bufferSize < 2) return;
                const kbSize = kb(this._buffer[1] + 1) * 4;
                if (this._bufferSize < kbSize + 2) return;
                this._emitRead({ controlCharacter: ControlCharacters.ReadKB, bytes: kbSize }, this._buffer.subarray(2, kbSize + 2));
                this._shiftBuffer(kbSize + 2);
                break;
            case ControlCharacters.ReadMB:
                if (this._bufferSize < 2) return;
                const mbSize = mb(this._buffer[1] + 1) * 4;
                if (this._bufferSize < mbSize + 2) return;
                this._emitRead({ controlCharacter: ControlCharacters.ReadMB, bytes: mbSize }, this._buffer.subarray(2, mbSize + 2));
                this._shiftBuffer(mbSize + 2);
                break;
            case ControlCharacters.ReadGB:
            case ControlCharacters.ReadTB:
            case ControlCharacters.ReadPB:
                // TODO: The SubData Java implementation does not yet support these either. This is a placeholder until we make sizes BigInts.
                throw new Error("Internal error: ReadGB, ReadTB, and ReadPB are not yet implemented.");
            case ControlCharacters.KeepAlive:
                this._shiftBuffer(1);
                break;
            case ControlCharacters.EndOfPacket:
                this._emitPacket();
                this._shiftBuffer(1);
                break;
            /* istanbul ignore next: this should never happen */
            default:
                throw new Error(
                    `Internal bug: Unhandled control character 0x${this._buffer[0].toString(16)}. Please report this as an issue on our GitHub.`
                );
        }

        if (this._bufferSize > 0) this._handleNewData();
    }

    /**
     * Called internally to add to the packet buffer and emit the {@link DirectStreamEvents.Read} event.
     *
     * The object in the first parameter accepts:
     * - controlCharacter: The control character that was read
     * - bytes: The number of bytes that were read
     * - numberOfType: The number of the type (e.g. for readKB(1), this should be 1)
     *
     * @param info See above
     * @param data The actual data that was read
     */
    private _emitRead(info: { controlCharacter: ControlCharacters.ReadByte; bytes: 1 }, data: number): void;
    private _emitRead(info: { controlCharacter: SizedControlCharacters; bytes: number }, data: Buffer): void;
    private _emitRead(
        { controlCharacter, bytes }: { controlCharacter: SizedControlCharacters | ControlCharacters.ReadByte; bytes: number },
        data: Buffer | number
    ): void {
        log("triggering read event of type", ControlCharacters[controlCharacter], "with data", data, "and size", bytes, "bytes");
        this._packet = Buffer.concat([this._packet, data instanceof Buffer ? data : Buffer.from([data])]);
        this._packetSize += bytes;
        /* istanbul ignore if: this should never reasonably happen & is untestable without a LOT of work */
        if (this._packetSize >= Number.MAX_SAFE_INTEGER - 1000) {
            this._packet = Buffer.alloc(0);
            this._packetSize = 0;
            throw new Error("Packet size exceeded or got very close to maximum safe integer. This is probably a bug.");
        }
        if (controlCharacter === ControlCharacters.ReadByte) {
            // TODO: Remove this cast. Probably need to use some sorta weird discrimination over the types.
            this.emit(StreamEvents.Read, Buffer.from([data as number]));
            return;
        } else this.emit(StreamEvents.Read, data as Buffer);
    }

    /** Called internally to clear and emit a packet. */
    private _emitPacket(): void {
        debug("triggering packet");
        this.emit(StreamEvents.Packet, this._packet);
        this._packet = Buffer.alloc(0);
        this._packetSize = 0;
    }

    /**
     * Shift the buffer by a certain amount.
     * @param count The amount to shift the buffer by
     */
    private _shiftBuffer(count: number): void {
        log("shifting internal buffer by", count);
        this._buffer = this._buffer.subarray(count);
        this._bufferSize -= count;
    }

    /**
     * Do some funny math to calculate the return value for {@link DirectStream._bestControlCharacter}.
     *
     * @param controlCharacter The control character being suggested
     * @param size The size in bytes
     * @param sizeFn The size function to use (probably one of {@link kb}, {@link mb}, or {@link bytes})
     */
    private _calculateControlCharacterRemainder(
        controlCharacter: SizedControlCharacters,
        size: number,
        sizeFn: (s: number) => number
    ): { controlCharacter: SizedControlCharacters; number: number; remainder: number } {
        const result = {
            controlCharacter,
            number: Math.min(255, Math.floor(size / sizeFn(4)) - 1),
            remainder: size - sizeFn(4) * (Math.min(255, Math.floor(size / sizeFn(4)) - 1) + 1)
        };
        log("calculated control character data for size", size, "bytes and control character", ControlCharacters[controlCharacter], "as", result);
        return result;
    }

    /**
     * Determine the best suitable control character for a given size, along with the remainder after
     * using that control character.
     * @param size The size in bytes
     */
    private _bestControlCharacter(
        size: number
    ):
        | { controlCharacter: ControlCharacters.ReadByte; number: -1; remainder: number }
        | { controlCharacter: SizedControlCharacters; number: number; remainder: number }
        | false {
        let result:
            | { controlCharacter: ControlCharacters.ReadByte; number: -1; remainder: number }
            | { controlCharacter: SizedControlCharacters; number: number; remainder: number }
            | false;
        if (size < 1) result = false;
        else if (size < 4) result = { controlCharacter: ControlCharacters.ReadByte, number: -1, remainder: size - 1 };
        else if (size < kb(4)) result = this._calculateControlCharacterRemainder(ControlCharacters.ReadBytes, size, bytes);
        else if (size < mb(4)) result = this._calculateControlCharacterRemainder(ControlCharacters.ReadKB, size, kb);
        else result = this._calculateControlCharacterRemainder(ControlCharacters.ReadMB, size, mb);
        log("best control character for size", size, "is", result);
        return result;
    }

    /**
     * Encode a Buffer into Layer 1 stream data.
     * @param data The data to encode
     */
    // TODO: Make private?
    public encode(input: Buffer): Buffer {
        log("encoding data", input);
        const size = input.length;
        let remaining = size;
        // TODO: Change this when GB/TB/PB support is added.

        // The algorithm here is as follows:
        // We repeatedly call to _bestControlCharacter and start populating an array with
        // the results of each along with the data it contains, then we flatten the array
        // and convert it to a Buffer.
        const results = [];
        while (remaining > 0) {
            log("remaining size", remaining);
            const data = this._bestControlCharacter(remaining);
            /* istanbul ignore next: this should never happen */
            if (data === false) throw new Error("This should never happen");
            const { controlCharacter, number, remainder } = data;
            if (controlCharacter === ControlCharacters.ReadByte) {
                results.push([controlCharacter, input.subarray(size - remaining, size - remaining + 1)]);
                remaining -= 1;
                continue;
            }

            /* istanbul ignore else */
            if ([ControlCharacters.ReadBytes, ControlCharacters.ReadKB, ControlCharacters.ReadMB].includes(controlCharacter)) {
                let byteSize;
                switch (controlCharacter) {
                    case ControlCharacters.ReadBytes:
                        byteSize = (number + 1) * 4;
                        break;
                    case ControlCharacters.ReadKB:
                        byteSize = kb(number + 1) * 4;
                        break;
                    case ControlCharacters.ReadMB:
                        byteSize = mb(number + 1) * 4;
                        break;
                    /* istanbul ignore next: this should never happen */
                    default:
                        throw new Error("This should never happen");
                }

                results.push([controlCharacter, number, input.subarray(size - remaining, size - remaining + byteSize)]);
                remaining -= byteSize;
                continue;
            }

            /* istanbul ignore next */
            throw new Error(`Unrecognized control character returned by _bestControlCharacter for size ${remainder}`);
        }
        const result = Buffer.from(results.flat().flatMap((x) => (x instanceof Buffer ? Array.from(x.values()) : x)));
        log("final result", result);
        return result;
    }

    /**
     * Write and encode data to send to the provider
     * Note: You probably want {@link Stream.writePacket} instead.
     * @param data The data to write
     */
    public async write(data: Buffer): Promise<void> {
        log("writing", data);
        return writeTo(this._socket, this.encode(data));
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
        return writeTo(this._socket, Buffer.concat([this.encode(data), Buffer.from([ControlCharacters.EndOfPacket])]));
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
