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

import ConnectedDuplex from "../../lib/ConnectedDuplex";
import { endStream, writeTo } from "../../lib/promisifiedStreamHelpers";
import Stream, { StreamEvents } from "../../stream";
import { ControlCharacters } from "../../stream/controlCharacters";
import DirectStream from "../../stream/DirectStream";

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

const encodeMock = jest.spyOn(DirectStream.prototype, "encode");
const feedMock = jest.spyOn(DirectStream.prototype, "feed");

beforeEach(() => {
    encodeMock.mockClear();
    feedMock.mockClear();
});

describe("Stream", () => {
    it("properly encodes when writing", async () => {
        const { stream, onRemoteRx } = makeNewStream();

        await stream.write(Buffer.from("Hello, World!"));

        expect(encodeMock).toHaveBeenCalledWith(Buffer.from("Hello, World!"));
        expect(onRemoteRx).toHaveBeenCalledWith(encodeMock.mock.results[0].value);
    });

    it("properly decodes when receiving", async () => {
        const { remote, onPacket } = makeNewStream();
        const direct = new DirectStream();

        const data = Buffer.concat([direct.encode(Buffer.from("Hello, World!")), Buffer.from([ControlCharacters.EndOfPacket])]);

        await writeTo(remote, data);

        expect(feedMock).toBeCalledTimes(1);
        expect(feedMock).toBeCalledWith(data);
        expect(onPacket).toBeCalledTimes(1);
        expect(onPacket).toBeCalledWith(Buffer.from("Hello, World!"));
    });

    it("emits Reset when a remote read reset is encountered and does discard the packet so far", async () => {
        const { remote, onPacket, onRead, onReset } = makeNewStream();
        const direct = new DirectStream();

        await writeTo(remote, direct.encode(Buffer.from("Hello, World!")));

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
