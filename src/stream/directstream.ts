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
import { bytes, kb, mb } from "../lib/sizeHelpers";
import { type SizedControlCharacters, ControlCharacters } from "./controlCharacters";

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
    [DirectStreamEvents.Read]: [ControlCharacters.ReadByte, 1, number] | [Exclude<ControlCharacters, ControlCharacters.ReadByte>, number, Buffer];
    /** Emitted when an End of Packet is received along with (size, data) parameters. */
    [DirectStreamEvents.Packet]: [number, Buffer];
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
 */
export default class DirectStream extends SafeEventEmitter<DirectStreamEventArguments> {
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
        this.emit(DirectStreamEvents.ReadReset);
    }

    /**
     * Command the stream to attempt to process new data. Called internally after {@link DirectStream.feed} is called.
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
    private _emitRead(info: { controlCharacter: ControlCharacters.ReadByte; bytes: 1; numberOfType: 1 }, data: number): void;
    private _emitRead(
        info: { controlCharacter: Exclude<ControlCharacters, ControlCharacters.ReadByte>; bytes: number; numberOfType: number },
        data: Buffer
    ): void;
    private _emitRead(
        { controlCharacter, bytes, numberOfType }: { controlCharacter: ControlCharacters; bytes: number; numberOfType: number },
        data: Buffer | number
    ): void {
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
            this.emit(DirectStreamEvents.Read, ControlCharacters.ReadByte, 1, data as number);
            return;
        } else this.emit(DirectStreamEvents.Read, controlCharacter, numberOfType, data as Buffer);
    }

    /** Called internally to clear and emit a packet. */
    private _emitPacket(): void {
        this.emit(DirectStreamEvents.Packet, this._packetSize, this._packet);
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
        return {
            controlCharacter,
            number: Math.min(255, Math.floor(size / sizeFn(4)) - 1),
            remainder: size - sizeFn(4) * (Math.min(255, Math.floor(size / sizeFn(4)) - 1) + 1)
        };
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
        if (size < 1) return false;
        if (size < 4) return { controlCharacter: ControlCharacters.ReadByte, number: -1, remainder: size - 1 };
        if (size < kb(4)) return this._calculateControlCharacterRemainder(ControlCharacters.ReadBytes, size, bytes);
        if (size < mb(4)) return this._calculateControlCharacterRemainder(ControlCharacters.ReadKB, size, kb);
        return this._calculateControlCharacterRemainder(ControlCharacters.ReadMB, size, mb);
    }

    /**
     * Encode a Buffer into Layer 1 stream data.
     * @param data The data to encode
     */
    public encode(input: Buffer): Buffer {
        const size = input.length;
        let remaining = size;
        // TODO: Change this when GB/TB/PB support is added.

        // The algorithm here is as follows:
        // We repeatedly call to _bestControlCharacter and start populating an array with
        // the results of each along with the data it contains, then we flatten the array
        // and convert it to a Buffer.
        const results = [];
        while (remaining > 0) {
            const data = this._bestControlCharacter(remaining);
            /* istanbul ignore next: this should never happen */
            if (data === false) throw new Error("This should never happen");
            const { controlCharacter, number, remainder } = data;
            if (controlCharacter === ControlCharacters.ReadByte) {
                results.push([controlCharacter, input.subarray(size - remaining, size - remaining + 1)]);
                remaining -= 1;
            } else if ([ControlCharacters.ReadBytes, ControlCharacters.ReadKB, ControlCharacters.ReadMB].includes(controlCharacter)) {
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
            } else throw new Error(`Unrecognized control character returned by _bestControlCharacter for size ${remainder}`);
        }
        return Buffer.from(results.flat().flatMap((x) => (x instanceof Buffer ? Array.from(x.values()) : x)));
    }
}
