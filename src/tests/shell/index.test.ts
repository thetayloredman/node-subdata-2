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
import { endStream } from "../../lib/promisifiedStreamHelpers";
import Shell, { ShellEvents } from "../../shell";
import RawShellAlgorithm from "../../shell/algorithms/Raw";
import Stream, { StreamEvents } from "../../stream";

function makeNewShell(): {
    local: ConnectedDuplex;
    remote: ConnectedDuplex;
    algorithm: RawShellAlgorithm;
    stream: Stream;
    shell: Shell;
    localPacket: jest.Mock;
    localRxEnd: jest.Mock;
} {
    const [local, remote] = ConnectedDuplex.new();
    const algorithm = new RawShellAlgorithm();
    const stream = new Stream(local);
    const shell = new Shell(algorithm, stream);

    const localPacket = jest.fn();
    const localRxEnd = jest.fn();

    shell.on(ShellEvents.Packet, localPacket);
    shell.on(ShellEvents.End, localRxEnd);

    return { local, remote, algorithm, stream, shell, localPacket, localRxEnd };
}

// The RawShellAlgorithm works fine as a mock algorithm.
const mockRawShellAlgorithmEncode = jest.spyOn(RawShellAlgorithm.prototype, "encode");
const mockRawShellAlgorithmDecode = jest.spyOn(RawShellAlgorithm.prototype, "decode");

// We also mock the Stream itself.
jest.mock("../../stream");
const MockedStream = Stream as jest.MockedClass<typeof Stream>;
const mockWritePacket = jest.fn(() => Promise.resolve());
const mockClose = jest.fn(() => Promise.resolve());
MockedStream.mockImplementation((...args) => {
    return new (class extends (jest.requireActual("../../stream").default as typeof Stream) {
        public writePacket = mockWritePacket;
        public close = mockClose;
    })(...args);
});

beforeEach(() => {
    mockRawShellAlgorithmEncode.mockClear();
    mockRawShellAlgorithmDecode.mockClear();
    mockWritePacket.mockClear();
    mockClose.mockClear();
});

describe("Shell", () => {
    it("simple transmit", () => {
        const { shell } = makeNewShell();
        const data = Buffer.from("Hello, world!");

        shell.send(data);

        expect(mockRawShellAlgorithmEncode).toBeCalledTimes(1);
        expect(mockRawShellAlgorithmEncode).toBeCalledWith(data);
        expect(mockWritePacket).toBeCalledTimes(1);
        expect(mockWritePacket).toBeCalledWith(mockRawShellAlgorithmEncode.mock.results[0].value);
    });

    it("simple receive", () => {
        const { stream, localPacket } = makeNewShell();
        // We don't care about the packet having proper shape, just the data itself.
        const data = Buffer.from("TEST");

        stream.emit(StreamEvents.Packet, data);

        expect(mockRawShellAlgorithmDecode).toBeCalledTimes(1);
        expect(mockRawShellAlgorithmDecode).toBeCalledWith(data);
        expect(localPacket).toBeCalledTimes(1);
        expect(localPacket).toBeCalledWith(data);
    });

    describe("close", () => {
        it("from remote", async () => {
            const { remote, localRxEnd } = makeNewShell();

            await endStream(remote);

            expect(localRxEnd).toBeCalledTimes(1);
        });

        it("from local", async () => {
            const { shell } = makeNewShell();

            await shell.close();

            expect(mockClose).toBeCalledTimes(1);
        });
    });
});
