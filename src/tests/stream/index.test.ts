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

import { kb, mb } from "../../lib/sizeHelpers";
import Stream, { StreamEvents } from "../../stream/";
import { ControlCharacters } from "../../stream/controlCharacters";

describe("Stream", () => {
    const stream = new Stream();

    const onRead = jest.fn(() => undefined);
    const onPacket = jest.fn(() => undefined);
    const onReset = jest.fn(() => undefined);

    stream.on(StreamEvents.Read, onRead);
    stream.on(StreamEvents.Packet, onPacket);
    stream.on(StreamEvents.ReadReset, onReset);

    beforeEach(() => {
        // Some tests will screw up the buffer by adding invalid data, and this is
        // the only way for us to recover.

        // @ts-expect-error: required reset to a private property
        stream._buffer = Buffer.alloc(0);
        // @ts-expect-error: required reset to a private property
        stream._bufferSize = 0;
        // @ts-expect-error: required reset to a private property
        stream._packet = Buffer.alloc(0);
        // @ts-expect-error: required reset to a private property
        stream._packetSize = 0;

        onRead.mockClear();
        onPacket.mockClear();
        onReset.mockClear();
    });

    it("errors when provided jumbled data", () => {
        expect(() => stream.feed(Buffer.from([0xff]))).toThrow(
            "I don't know what I am looking at! Encountered unknown control character 0xff in stream."
        );
    });

    it("does nothing for KeepAlive", () => {
        stream.feed(Buffer.from([ControlCharacters.KeepAlive]));
        expect(onRead).not.toHaveBeenCalled();
        expect(onPacket).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
    });

    it("single reset", () => {
        stream.feed(Buffer.from([ControlCharacters.ReadReset]));
        expect(onRead).not.toHaveBeenCalled();
        expect(onPacket).not.toHaveBeenCalled();
        expect(onReset).toHaveBeenCalledTimes(1);
        expect(onReset).toHaveBeenCalledWith();
    });

    it("multiple resets", () => {
        stream.feed(Buffer.from([ControlCharacters.ReadReset, ControlCharacters.ReadReset]));
        expect(onRead).not.toHaveBeenCalled();
        expect(onPacket).not.toHaveBeenCalled();
        expect(onReset).toHaveBeenCalledTimes(2);
        expect(onReset).toHaveBeenLastCalledWith();
        expect(onReset).toHaveBeenNthCalledWith(1);
    });

    it("empty packet", () => {
        stream.feed(Buffer.from([ControlCharacters.EndOfPacket]));
        expect(onRead).not.toHaveBeenCalled();
        expect(onPacket).toHaveBeenCalledTimes(1);
        expect(onPacket).toHaveBeenCalledWith(0, Buffer.alloc(0));
        expect(onReset).not.toHaveBeenCalled();
    });

    it("single byte packet", () => {
        stream.feed(Buffer.from([ControlCharacters.ReadByte, 0x01, ControlCharacters.EndOfPacket]));
        expect(onRead).toHaveBeenCalledTimes(1);
        expect(onRead).toHaveBeenCalledWith(ControlCharacters.ReadByte, 1, 1);
        expect(onPacket).toHaveBeenCalledTimes(1);
        expect(onPacket).toHaveBeenCalledWith(1, Buffer.from([1]));
        expect(onReset).not.toHaveBeenCalled();
    });

    it("waits when read is incomplete", () => {
        stream.feed(Buffer.from([ControlCharacters.ReadByte]));
        expect(onRead).not.toHaveBeenCalled();
        expect(onPacket).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
        stream.feed(Buffer.from([0x01]));
        expect(onRead).toHaveBeenCalledTimes(1);
        expect(onRead).toHaveBeenCalledWith(ControlCharacters.ReadByte, 1, 1);
        expect(onPacket).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
    });

    it("longer read", () => {
        stream.feed(
            Buffer.from([
                ControlCharacters.ReadBytes,
                0x2, // 4 * (2+1) = 12 bytes
                0x0,
                0x1,
                0x2,
                0x3,
                0x4,
                0x5,
                0x6,
                0x7,
                0x8,
                0x9,
                0xa,
                0xb, // 12 bytes done
                ControlCharacters.EndOfPacket
            ])
        );
        expect(onRead).toHaveBeenCalledTimes(1);
        expect(onRead).toHaveBeenCalledWith(
            ControlCharacters.ReadBytes,
            2,
            Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb])
        );
        expect(onPacket).toHaveBeenCalledTimes(1);
        expect(onPacket).toHaveBeenCalledWith(12, Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb]));
        expect(onReset).not.toHaveBeenCalled();
    });

    it("long read with missing size", () => {
        stream.feed(Buffer.from([ControlCharacters.ReadBytes]));
        expect(onRead).not.toHaveBeenCalled();
        expect(onPacket).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
        stream.feed(Buffer.from([0x2, 0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, ControlCharacters.EndOfPacket]));
        expect(onRead).toHaveBeenCalledTimes(1);
        expect(onRead).toHaveBeenCalledWith(
            ControlCharacters.ReadBytes,
            2,
            Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb])
        );
        expect(onPacket).toHaveBeenCalledTimes(1);
        expect(onPacket).toHaveBeenCalledWith(12, Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb]));
        expect(onReset).not.toHaveBeenCalled();
    });

    it("long read interrupted in the middle", () => {
        stream.feed(Buffer.from([ControlCharacters.ReadBytes, 0x02, 0x00, 0x01, 0x02, 0x03, 0x04]));
        expect(onRead).not.toHaveBeenCalled();
        expect(onPacket).not.toHaveBeenCalled();
        expect(onReset).not.toHaveBeenCalled();
        stream.feed(Buffer.from([0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, ControlCharacters.EndOfPacket]));
        expect(onRead).toHaveBeenCalledTimes(1);
        expect(onRead).toHaveBeenCalledWith(
            ControlCharacters.ReadBytes,
            2,
            Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b])
        );
        expect(onPacket).toHaveBeenCalledTimes(1);
        expect(onPacket).toHaveBeenCalledWith(12, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]));
        expect(onReset).not.toHaveBeenCalled();
    });

    it("Read Reset after a read will actually reset", () => {
        stream.feed(Buffer.from([ControlCharacters.ReadByte, 0x00, ControlCharacters.ReadReset, ControlCharacters.EndOfPacket]));
        expect(onRead).toHaveBeenCalledTimes(1);
        expect(onRead).toHaveBeenCalledWith(ControlCharacters.ReadByte, 1, 0);
        expect(onPacket).toHaveBeenCalledTimes(1);
        expect(onPacket).toHaveBeenCalledWith(0, Buffer.alloc(0));
        expect(onReset).toHaveBeenCalledTimes(1);
        expect(onReset).toHaveBeenCalledWith();
    });

    describe("_bestControlCharacter", () => {
        it("nothing => returns false", () => {
            // @ts-expect-error: testing a private method
            expect(stream._bestControlCharacter(0)).toBe(false);
        });

        function factory(name: string, size: number, result: ReturnType<Stream["_bestControlCharacter"]>): void {
            it(name, () => {
                // @ts-expect-error: testing a private method
                expect(stream._bestControlCharacter(size)).toEqual(result);
            });
        }

        factory("one byte => ReadByte", 1, { controlCharacter: ControlCharacters.ReadByte, number: -1, remainder: 0 });
        factory("two bytes => ReadByte", 2, { controlCharacter: ControlCharacters.ReadByte, number: -1, remainder: 1 });
        factory("three bytes => ReadByte", 3, { controlCharacter: ControlCharacters.ReadByte, number: -1, remainder: 2 });
        factory("four bytes => ReadBytes", 4, { controlCharacter: ControlCharacters.ReadBytes, number: 0, remainder: 0 });
        factory("five bytes => ReadBytes", 5, { controlCharacter: ControlCharacters.ReadBytes, number: 0, remainder: 1 });
        factory("six bytes => ReadBytes", 6, { controlCharacter: ControlCharacters.ReadBytes, number: 0, remainder: 2 });
        factory("seven bytes => ReadBytes", 7, { controlCharacter: ControlCharacters.ReadBytes, number: 0, remainder: 3 });
        factory("eight bytes => ReadBytes", 8, { controlCharacter: ControlCharacters.ReadBytes, number: 1, remainder: 0 });
        factory("nine bytes => ReadBytes", 9, { controlCharacter: ControlCharacters.ReadBytes, number: 1, remainder: 1 });
        factory("ten bytes => ReadBytes", 10, { controlCharacter: ControlCharacters.ReadBytes, number: 1, remainder: 2 });
        factory("eleven bytes => ReadBytes", 11, { controlCharacter: ControlCharacters.ReadBytes, number: 1, remainder: 3 });
        factory("twelve bytes => ReadBytes", 12, { controlCharacter: ControlCharacters.ReadBytes, number: 2, remainder: 0 });
        factory("thirteen bytes => ReadBytes", 13, { controlCharacter: ControlCharacters.ReadBytes, number: 2, remainder: 1 });
        factory("fourteen bytes => ReadBytes", 14, { controlCharacter: ControlCharacters.ReadBytes, number: 2, remainder: 2 });
        factory("fifteen bytes => ReadBytes", 15, { controlCharacter: ControlCharacters.ReadBytes, number: 2, remainder: 3 });
        // That's enough.

        factory("2000 bytes yields number=255", 2000, { controlCharacter: ControlCharacters.ReadBytes, number: 255, remainder: 2000 - 4 * 256 });

        factory("4kb => ReadKB", kb(4), { controlCharacter: ControlCharacters.ReadKB, number: 0, remainder: 0 });
        factory("5kb => ReadKB", kb(5), { controlCharacter: ControlCharacters.ReadKB, number: 0, remainder: kb(1) });
        factory("8kb => ReadKB", kb(8), { controlCharacter: ControlCharacters.ReadKB, number: 1, remainder: 0 });
        factory("2000kb yields number=255", kb(2000), { controlCharacter: ControlCharacters.ReadKB, number: 255, remainder: kb(2000 - 256) });

        factory("4mb => ReadMB", mb(4), { controlCharacter: ControlCharacters.ReadMB, number: 0, remainder: 0 });
        factory("5mb => ReadMB", mb(5), { controlCharacter: ControlCharacters.ReadMB, number: 0, remainder: mb(1) });
        factory("8mb => ReadMB", mb(8), { controlCharacter: ControlCharacters.ReadMB, number: 1, remainder: 0 });
        factory("2000mb yields number=255", mb(2000), { controlCharacter: ControlCharacters.ReadMB, number: 255, remainder: mb(2000 - 256) });
    });

    describe("encode", () => {
        function factory(name: string, input: Buffer, output: Buffer): void {
            it(name, () => {
                expect(stream.encode(input)).toEqual(output);
            });
        }

        factory("nothing => returns empty buffer", Buffer.alloc(0), Buffer.alloc(0));
        factory("one byte => read-byte once", Buffer.from([0x00]), Buffer.from([ControlCharacters.ReadByte, 0x00]));
        factory(
            "two bytes => read-byte twice",
            Buffer.from([0x00, 0x01]),
            Buffer.from([ControlCharacters.ReadByte, 0x00, ControlCharacters.ReadByte, 0x01])
        );
        factory(
            "three bytes => read-byte three times",
            Buffer.from([0x00, 0x01, 0x02]),
            Buffer.from([ControlCharacters.ReadByte, 0x00, ControlCharacters.ReadByte, 0x01, ControlCharacters.ReadByte, 0x02])
        );
        factory(
            "four bytes => read-bytes once",
            Buffer.from([0x00, 0x01, 0x02, 0x03]),
            Buffer.from([ControlCharacters.ReadBytes, 0x00, 0x00, 0x01, 0x02, 0x03])
        );
        factory(
            "five bytes => read-bytes once and a read-byte",
            Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]),
            Buffer.from([ControlCharacters.ReadBytes, 0x00, 0x00, 0x01, 0x02, 0x03, ControlCharacters.ReadByte, 0x04])
        );
        factory(
            "eight bytes => read-bytes 2x",
            Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
            Buffer.from([ControlCharacters.ReadBytes, 0x01, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
        );
        factory(
            "15 bytes does what you'd expect",
            Buffer.alloc(15).fill(0xff),
            Buffer.from([
                ControlCharacters.ReadBytes,
                0x02,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                0xff,
                ControlCharacters.ReadByte,
                0xff,
                ControlCharacters.ReadByte,
                0xff,
                ControlCharacters.ReadByte,
                0xff
            ])
        );
        // TODO: more?
    });
});
