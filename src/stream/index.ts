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
import { kb, mb } from "../lib/sizeHelpers";
import { ControlCharacters } from "./controlCharacters";

export enum StreamEvents {
    ReadReset = "reset",
    Read = "read",
    Packet = "packet"
}

export type StreamEventArguments = {
    /** Emitted when the stream is reset */
    [StreamEvents.ReadReset]: [];
    /**
     * Emitted when the stream reads data.
     * This event may fire before the end of a packet.
     * Fires with three arguments, the size read in ControlCharacters, the number of that size read, and the data read.
     * ReadByte will return Number, the rest will return Buffer.
     */
    [StreamEvents.Read]: [ControlCharacters.ReadByte, 1, number] | [Exclude<ControlCharacters, ControlCharacters.ReadByte>, number, Buffer];
    /** Emitted when an End of Packet is received along with (size, data) parameters. */
    [StreamEvents.Packet]: [number, Buffer];
};

/**
 * Represents the {@link https://github.com/ME1312/SubData-2/wiki/Protocol-Format#layer-1-the-stream SubData Stream}.
 *
 * This Stream class is a wrapper around a buffer that handles the reading of packets.
 *
 * It emits a few events, which can be found in {@link StreamEvents} and {@link StreamEventArguments}.
 *
 * You can feed a Stream raw data with its {@link Stream.feed} method.
 */
export default class Stream extends SafeEventEmitter<StreamEventArguments> {
    /** The buffer of the stream */
    private _buffer: Buffer;
    /** The size of the buffer */
    private _bufferSize: number;
    /** The buffer of the current read packet */
    private _packet: Buffer;
    /** The size of the current read packet */
    private _packetSize: number;

    public constructor() {
        super();
        this._buffer = Buffer.alloc(0);
        this._bufferSize = 0;
        this._packet = Buffer.alloc(0);
        this._packetSize = 0;
    }

    /**
     * Feed new data to this Stream.
     * @param data The data to feed
     */
    public feed(data: Buffer): void {
        this._buffer = Buffer.concat([this._buffer, data]);
        this._bufferSize += data.length;
        this._handleNewData();
    }

    /**
     * Invalidates all previous data. Called internally when a {@link ControlCharacters.ReadReset} is encountered.
     */
    private _readReset(): void {
        this._buffer = Buffer.alloc(0);
        this._bufferSize = 0;
        this._packet = Buffer.alloc(0);
        this._packetSize = 0;
        this.emit(StreamEvents.ReadReset);
    }

    /**
     * Command the stream to attempt to process new data. Called internally after {@link Stream.feed} is called.
     */
    private _handleNewData(): void {
        if (this._bufferSize === 0) return;
        const char = this._buffer[0];

        if (!(char.toString() in ControlCharacters))
            throw new Error(`I don't know what I am looking at! Encountered unknown control character 0x${this._buffer[0].toString(16)} in stream.`);

        switch (this._buffer[0]) {
            case ControlCharacters.ReadReset:
                const postReset = this._buffer.subarray(1);
                this._readReset();
                // Re-insert all data that follows the reset
                this.feed(postReset);
                break;
            case ControlCharacters.ReadByte:
                if (this._bufferSize < 2) return;
                this._emitRead({ controlCharacter: ControlCharacters.ReadByte, bytes: 1, numberOfType: 1 }, this._buffer[1]);
                this._shiftBuffer(2);
                break;
            case ControlCharacters.ReadBytes:
                if (this._bufferSize < 2) return;
                const byteSize = (this._buffer[1] + 1) * 4;
                if (this._bufferSize < byteSize + 2) return;
                this._emitRead(
                    { controlCharacter: ControlCharacters.ReadBytes, bytes: byteSize, numberOfType: this._buffer[1] },
                    this._buffer.subarray(2, byteSize + 2)
                );
                this._shiftBuffer(byteSize + 2);
                break;
            case ControlCharacters.ReadKB:
                if (this._bufferSize < 2) return;
                const kbSize = kb(this._buffer[1] + 1) * 4;
                if (this._bufferSize < kbSize + 2) return;
                this._emitRead(
                    { controlCharacter: ControlCharacters.ReadKB, bytes: kbSize, numberOfType: this._buffer[1] },
                    this._buffer.subarray(2, kbSize + 2)
                );
                this._shiftBuffer(kbSize + 2);
                break;
            case ControlCharacters.ReadMB:
                if (this._bufferSize < 2) return;
                const mbSize = mb(this._buffer[1] + 1) * 4;
                if (this._bufferSize < mbSize + 2) return;
                this._emitRead(
                    { controlCharacter: ControlCharacters.ReadMB, bytes: mbSize, numberOfType: this._buffer[1] },
                    this._buffer.subarray(2, mbSize + 2)
                );
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
     * Called internally to add to the packet buffer and emit the {@link StreamEvents.Read} event.
     *
     * The object in the first parameter accepts:
     * - controlCharacter: The control character that was read
     * - bytes: The number of bytes that were read
     * - numberOfType: The number of the type (e.g. for readKB(1), this should be 1)
     *
     * @param info See above
     * @param data The actual data that was read
     */
    private _emitRead(info: { controlCharacter: ControlCharacters.ReadByte; bytes: 1; numberOfType: 1 }, data: number): void;
    private _emitRead(
        info: { controlCharacter: Exclude<ControlCharacters, ControlCharacters.ReadByte>; bytes: number; numberOfType: number },
        data: Buffer
    ): void;
    private _emitRead(
        { controlCharacter, bytes, numberOfType }: { controlCharacter: ControlCharacters; bytes: number; numberOfType: number },
        data: Buffer | number
    ): void {
        // FIXME: The toString here is probably dumb
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
            this.emit(StreamEvents.Read, ControlCharacters.ReadByte, 1, data as number);
            return;
        } else this.emit(StreamEvents.Read, controlCharacter, numberOfType, data as Buffer);
    }

    /** Called internally to clear and emit a packet. */
    private _emitPacket(): void {
        this.emit(StreamEvents.Packet, this._packetSize, this._packet);
        this._packet = Buffer.alloc(0);
        this._packetSize = 0;
    }

    /**
     * Shift the buffer by a certain amount.
     * @param count The amount to shift the buffer by
     */
    private _shiftBuffer(count = 0): void {
        this._buffer = this._buffer.subarray(count);
        this._bufferSize -= count;
    }
}
