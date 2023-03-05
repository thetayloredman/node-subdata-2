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

import DumbClient, { DumbClientEvents } from "../DumbClient";
import ConnectedDuplex from "../lib/ConnectedDuplex";
import Packet from "../Packet";
import Shell, { ShellEvents } from "../shell";
import RawShellAlgorithm from "../shell/algorithms/Raw";
import Stream from "../stream";

function makeNewDumbClient(): {
    client: DumbClient;
    shell: Shell;
    onPacket: jest.Mock;
    onEnd: jest.Mock;
} {
    // 99% of these won't be ever interfaced with, but we
    // create them as the constructors require them.
    const [local, _] = ConnectedDuplex.new();
    const stream = new Stream(local);
    const algorithm = new RawShellAlgorithm();
    const shell = new Shell(algorithm, stream);
    const client = new DumbClient(shell);

    const onPacket = jest.fn();
    const onEnd = jest.fn();

    client.on(DumbClientEvents.Packet, onPacket);
    client.on(DumbClientEvents.End, onEnd);

    return { client, shell, onPacket, onEnd };
}

// Spy mocks on Packet
const ActualPacket = jest.requireActual("../Packet").default as typeof Packet;
const mockPacketToRaw = jest.fn(ActualPacket.prototype.toRaw);
jest.mock("../Packet", () => {
    return jest.fn().mockImplementation((...args: [Buffer]) => {
        return new (class extends (jest.requireActual("../Packet").default as typeof Packet) {
            public toRaw = mockPacketToRaw;
        })(...args);
    });
});
const MockPacket = Packet as jest.MockedClass<typeof Packet>;

// Mock the Shell class.
jest.mock("../shell");
const mockShellClose = jest.fn();
const mockShellSend = jest.fn();
const MockedShell = Shell as jest.MockedClass<typeof Shell>;
MockedShell.mockImplementation((...args) => {
    return new (class extends (jest.requireActual("../shell").default as typeof Shell) {
        public close = mockShellClose;
        public send = mockShellSend;
    })(...args);
});

beforeEach(() => {
    MockPacket.mockClear();
    mockPacketToRaw.mockClear();
    mockShellClose.mockClear();
    mockShellSend.mockClear();
});

describe("DumbClient", () => {
    it("creates packet on rx", () => {
        const { shell, onPacket } = makeNewDumbClient();

        shell.emit(ShellEvents.Packet, Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]));

        expect(MockPacket).toBeCalledTimes(1);
        expect(MockPacket).toBeCalledWith(Buffer.from([0xaa, 0xbb, 0xcc, 0xdd]));
        expect(onPacket).toBeCalledTimes(1);
        // Slightly ugly workaround to convert from ActualPacket to mocked Packet
        expect(onPacket).toBeCalledWith(new Packet(ActualPacket.fromID(0xaabb, Buffer.from([0xcc, 0xdd])).toRaw()));
    });

    it("local tx is transmitted as expected", async () => {
        const { client } = makeNewDumbClient();

        const packet = new Packet(ActualPacket.fromID(0xffff, Buffer.from("Hello, World!")).toRaw());

        await client.send(packet);

        expect(mockPacketToRaw).toBeCalledTimes(1);
        expect(mockShellSend).toBeCalledTimes(1);
        expect(mockShellSend).toBeCalledWith(packet.toRaw());
    });

    describe("close", () => {
        it("from remote", () => {
            const { shell, onEnd } = makeNewDumbClient();

            shell.emit(ShellEvents.End);

            expect(onEnd).toBeCalledTimes(1);
        });
        it("commanded", async () => {
            const { client } = makeNewDumbClient();

            await client.close();

            expect(mockShellClose).toBeCalledTimes(1);
        });
    });
});
