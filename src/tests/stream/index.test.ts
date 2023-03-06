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

import { Duplex } from "node:stream";

import ConnectedDuplex from "../../lib/ConnectedDuplex";
import { endStream, writeTo } from "../../lib/promisifiedStreamHelpers";
import { kb, mb } from "../../lib/sizeHelpers";
import Stream, { StreamEvents } from "../../stream";
import { ControlCharacters } from "../../stream/controlCharacters";

/** A duplex stream which does nothing. */
class NullDuplex extends Duplex {
    public _read(): void {
        this.push(null);
    }
    public _write(_chunk: unknown, _encoding: unknown, callback: (error?: Error | null | undefined) => void): void {
        callback();
    }
}

/** Makes a new {@link Stream} along with mock functions and a {@link ManualIOProvider} */
function makeNewStream(): {
    local: ConnectedDuplex;
    remote: ConnectedDuplex;
    stream: Stream;
    onPacket: jest.Mock;
    onReset: jest.Mock;
    onRead: jest.Mock;
    onRemoteRxEnd: jest.Mock;
    onRemoteRx: jest.Mock;
    onLocalRxEnd: jest.Mock;
} {
    const [local, remote] = ConnectedDuplex.new();
    const stream = new Stream(local);

    const onRemoteRx = jest.fn();
    const onRemoteRxEnd = jest.fn();
    const onLocalRxEnd = jest.fn();
    const onReset = jest.fn();
    const onPacket = jest.fn();
    const onRead = jest.fn();

    remote.on("data", onRemoteRx);
    remote.on("end", onRemoteRxEnd);
    stream.on(StreamEvents.End, onLocalRxEnd);
    stream.on(StreamEvents.Reset, onReset);
    stream.on(StreamEvents.Packet, onPacket);
    stream.on(StreamEvents.Read, onRead);

    return { local, remote, stream, onPacket, onReset, onRead, onRemoteRxEnd, onRemoteRx, onLocalRxEnd };
}

function charCode(char: string): number {
    return char.charCodeAt(0);
}

/** Like C's memcmp() for buffers. Used in the large-buffer tests to avoid long test times */
function bufncmp(n: number, left: Buffer, right: Buffer): number {
    const len = Math.min(left.length, right.length, n);
    for (let i = 0; i < len; i++) {
        if (left[i] < right[i]) return -1;
        if (left[i] > right[i]) return 1;
    }
    return 0;
}

const encodeMock = jest.spyOn(Stream.prototype, "encode");

beforeEach(() => {
    encodeMock.mockClear();
});

describe("Stream", () => {
    describe("overall behavior", () => {
        it("properly encodes when writing", async () => {
            const { stream, onRemoteRx } = makeNewStream();

            await stream.write(Buffer.from("Hello, World!"));

            expect(encodeMock).toHaveBeenCalledWith(Buffer.from("Hello, World!"));
            expect(onRemoteRx).toHaveBeenCalledWith(encodeMock.mock.results[0].value);
        });

        it("properly decodes when receiving", async () => {
            const { stream, remote, onPacket } = makeNewStream();

            const data = Buffer.concat([stream.encode(Buffer.from("Hello, World!")), Buffer.from([ControlCharacters.EndOfPacket])]);

            await writeTo(remote, data);

            expect(onPacket).toBeCalledTimes(1);
            expect(onPacket).toBeCalledWith(Buffer.from("Hello, World!"));
        });

        it("emits Reset when a remote read reset is encountered and does discard the packet so far", async () => {
            const { stream, remote, onPacket, onRead, onReset } = makeNewStream();

            await writeTo(remote, stream.encode(Buffer.from("Hello, World!")));

            expect(onPacket).toBeCalledTimes(0);
            expect(onRead).toBeCalledTimes(2);
            expect(onRead).toHaveBeenNthCalledWith(1, Buffer.from("Hello, World"));
            expect(onRead).toHaveBeenNthCalledWith(2, Buffer.from("!"));

            await writeTo(remote, Buffer.from([ControlCharacters.ReadReset]));

            expect(onReset).toBeCalledTimes(1);
            expect(onPacket).toBeCalledTimes(0);
            expect(onRead).toBeCalledTimes(2);

            await writeTo(remote, Buffer.from([ControlCharacters.EndOfPacket]));

            expect(onReset).toBeCalledTimes(1);
            expect(onPacket).toBeCalledTimes(1);
            expect(onPacket).toBeCalledWith(Buffer.alloc(0));
            expect(onRead).toBeCalledTimes(2);
        });

        it("can terminate packets", async () => {
            const { stream, onRemoteRx } = makeNewStream();

            await stream.write(Buffer.from("A"));
            await stream.endPacket();

            expect(onRemoteRx).toBeCalledTimes(2);
            expect(onRemoteRx).toHaveBeenNthCalledWith(1, Buffer.from([ControlCharacters.ReadByte, charCode("A")]));
            expect(onRemoteRx).toHaveBeenNthCalledWith(2, Buffer.from([ControlCharacters.EndOfPacket]));
        });

        it("writePacket will also do the same thing", async () => {
            const { stream, onRemoteRx } = makeNewStream();

            await stream.writePacket(Buffer.from("A"));

            expect(onRemoteRx).toBeCalledTimes(1);
            expect(onRemoteRx).toHaveBeenCalledWith(Buffer.from([ControlCharacters.ReadByte, charCode("A"), ControlCharacters.EndOfPacket]));
        });

        it("can transmit read reset", async () => {
            const { stream, onRemoteRx } = makeNewStream();

            await stream.write(Buffer.from("A"));
            await stream.readReset();

            expect(onRemoteRx).toBeCalledTimes(2);
            expect(onRemoteRx).toHaveBeenNthCalledWith(1, Buffer.from([ControlCharacters.ReadByte, charCode("A")]));
            expect(onRemoteRx).toHaveBeenNthCalledWith(2, Buffer.from([ControlCharacters.ReadReset]));
        });

        describe("close", () => {
            it("received from remote", async () => {
                const { remote, onLocalRxEnd } = makeNewStream();

                await endStream(remote);

                expect(onLocalRxEnd).toBeCalledTimes(1);
            });

            it("sent from local", async () => {
                const { stream, onRemoteRxEnd } = makeNewStream();

                await stream.close();

                expect(onRemoteRxEnd).toBeCalledTimes(1);
            });
        });
    });
    describe("layer-1 handling", () => {
        // TODO: Hard to test because of the function throwing an error from within the event queue
        // instead of synchronously.
        it.todo("errors when provided jumbled data");
        it.todo("fails for unsupported read sizes");

        it("does nothing for KeepAlive", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.KeepAlive]));

            expect(onRead).not.toHaveBeenCalled();
            expect(onPacket).not.toHaveBeenCalled();
            expect(onReset).not.toHaveBeenCalled();
        });

        it("single reset", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.ReadReset]));

            expect(onRead).not.toHaveBeenCalled();
            expect(onPacket).not.toHaveBeenCalled();
            expect(onReset).toHaveBeenCalledTimes(1);
            expect(onReset).toHaveBeenCalledWith();
        });

        it("multiple resets", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.ReadReset, ControlCharacters.ReadReset]));

            expect(onRead).not.toHaveBeenCalled();
            expect(onPacket).not.toHaveBeenCalled();
            expect(onReset).toHaveBeenCalledTimes(2);
            expect(onReset).toHaveBeenLastCalledWith();
            expect(onReset).toHaveBeenNthCalledWith(1);
        });

        it("empty packet", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.EndOfPacket]));

            expect(onRead).not.toHaveBeenCalled();
            expect(onPacket).toHaveBeenCalledTimes(1);
            expect(onPacket).toHaveBeenCalledWith(Buffer.alloc(0));
            expect(onReset).not.toHaveBeenCalled();
        });

        it("single byte packet", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.ReadByte, 0x01, ControlCharacters.EndOfPacket]));

            expect(onRead).toHaveBeenCalledTimes(1);
            expect(onRead).toHaveBeenCalledWith(Buffer.from([1]));
            expect(onPacket).toHaveBeenCalledTimes(1);
            expect(onPacket).toHaveBeenCalledWith(Buffer.from([1]));
            expect(onReset).not.toHaveBeenCalled();
        });

        it("waits when read is incomplete", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.ReadByte]));

            expect(onRead).not.toHaveBeenCalled();
            expect(onPacket).not.toHaveBeenCalled();
            expect(onReset).not.toHaveBeenCalled();

            await writeTo(remote, Buffer.from([0x01, ControlCharacters.EndOfPacket]));

            expect(onRead).toHaveBeenCalledTimes(1);
            expect(onRead).toHaveBeenCalledWith(Buffer.from([1]));
            expect(onPacket).toHaveBeenCalledTimes(1);
            expect(onPacket).toHaveBeenCalledWith(Buffer.from([1]));
            expect(onReset).not.toHaveBeenCalled();
        });

        it("longer read", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(
                remote,
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
            expect(onRead).toHaveBeenCalledWith(Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb]));
            expect(onPacket).toHaveBeenCalledTimes(1);
            expect(onPacket).toHaveBeenCalledWith(Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb]));
            expect(onReset).not.toHaveBeenCalled();
        });

        it("long read with missing size", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.ReadBytes]));

            expect(onRead).not.toHaveBeenCalled();
            expect(onPacket).not.toHaveBeenCalled();
            expect(onReset).not.toHaveBeenCalled();

            await writeTo(remote, Buffer.from([0x2, 0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb, ControlCharacters.EndOfPacket]));

            expect(onRead).toHaveBeenCalledTimes(1);
            expect(onRead).toHaveBeenCalledWith(Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb]));
            expect(onPacket).toHaveBeenCalledTimes(1);
            expect(onPacket).toHaveBeenCalledWith(Buffer.from([0x0, 0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xa, 0xb]));
            expect(onReset).not.toHaveBeenCalled();
        });

        it("long read interrupted in the middle", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.ReadBytes, 0x02, 0x00, 0x01, 0x02, 0x03, 0x04]));

            expect(onRead).not.toHaveBeenCalled();
            expect(onPacket).not.toHaveBeenCalled();
            expect(onReset).not.toHaveBeenCalled();

            await writeTo(remote, Buffer.from([0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, ControlCharacters.EndOfPacket]));

            expect(onRead).toHaveBeenCalledTimes(1);
            expect(onRead).toHaveBeenCalledWith(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]));
            expect(onPacket).toHaveBeenCalledTimes(1);
            expect(onPacket).toHaveBeenCalledWith(Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]));
            expect(onReset).not.toHaveBeenCalled();
        });

        it("Read Reset after a read will actually reset", async () => {
            const { remote, onRead, onPacket, onReset } = makeNewStream();

            await writeTo(remote, Buffer.from([ControlCharacters.ReadByte, 0x00, ControlCharacters.ReadReset, ControlCharacters.EndOfPacket]));

            expect(onRead).toHaveBeenCalledTimes(1);
            expect(onRead).toHaveBeenCalledWith(Buffer.from([0]));
            expect(onPacket).toHaveBeenCalledTimes(1);
            expect(onPacket).toHaveBeenCalledWith(Buffer.alloc(0));
            expect(onReset).toHaveBeenCalledTimes(1);
            expect(onReset).toHaveBeenCalledWith();
        });

        describe("_bestControlCharacter", () => {
            it("nothing => returns false", () => {
                const stream = new Stream(new NullDuplex());

                // @ts-expect-error: testing a private method
                expect(stream._bestControlCharacter(0)).toBe(false);
            });

            function factory(name: string, size: number, result: ReturnType<Stream["_bestControlCharacter"]>): void {
                it(name, () => {
                    const stream = new Stream(new NullDuplex());

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
            factory("2000kb yields number=255", kb(2000), {
                controlCharacter: ControlCharacters.ReadKB,
                number: 255,
                remainder: kb(2000) - 4 * kb(256)
            });

            factory("4mb => ReadMB", mb(4), { controlCharacter: ControlCharacters.ReadMB, number: 0, remainder: 0 });
            factory("5mb => ReadMB", mb(5), { controlCharacter: ControlCharacters.ReadMB, number: 0, remainder: mb(1) });
            factory("8mb => ReadMB", mb(8), { controlCharacter: ControlCharacters.ReadMB, number: 1, remainder: 0 });
            factory("2000mb yields number=255", mb(2000), {
                controlCharacter: ControlCharacters.ReadMB,
                number: 255,
                remainder: mb(2000) - 4 * mb(256)
            });
        });

        describe("encode", () => {
            function factory(name: string, input: Buffer, output: Buffer): void {
                it(name, () => {
                    const stream = new Stream(new NullDuplex());

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
            it("4kb", () => {
                const stream = new Stream(new NullDuplex());

                const expected = Buffer.concat([Buffer.from([ControlCharacters.ReadKB, 0x00]), Buffer.alloc(kb(4))]);

                // Running .toEqual is extremely slow on huge buffers, so we use a custom bufncmp function
                expect(bufncmp(3, stream.encode(expected.subarray(2)), expected)).toBe(0);
            });
            it("4mb", () => {
                const stream = new Stream(new NullDuplex());

                const expected = Buffer.concat([Buffer.from([ControlCharacters.ReadMB, 0x00]), Buffer.alloc(mb(4))]);

                // See above
                expect(bufncmp(3, stream.encode(expected.subarray(2)), expected)).toBe(0);
            });
        });
    });
});
