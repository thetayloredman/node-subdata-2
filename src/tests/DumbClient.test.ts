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

import DumbClient, { DumbClientEvents } from "../DumbClient";
import Packet from "../Packet";
import Shell from "../shell";
import RawShellAlgorithm from "../shell/algorithms/Raw";
import Stream from "../stream";
import { ControlCharacters } from "../stream/controlCharacters";
import DirectStream from "../stream/DirectStream";
import ManualIOProvider from "../stream/providers/ManualIOProvider";

function makeNewDumbClient(): {
    client: DumbClient;
    stream: Stream;
    algorithm: RawShellAlgorithm;
    shell: Shell;
    provider: ManualIOProvider;
    onPacket: jest.Mock;
    manual: ManualIOProvider["manual"];
    onClose: jest.Mock;
    onRemoteRx: jest.Mock;
    onRemoteRxClose: jest.Mock;
} {
    const provider = new ManualIOProvider();
    const { manual } = provider;
    const stream = new Stream(provider);
    const algorithm = new RawShellAlgorithm();
    const shell = new Shell(algorithm, stream);
    const client = new DumbClient(shell);

    const onPacket = jest.fn();
    const onClose = jest.fn();
    const onRemoteRx = jest.fn();
    const onRemoteRxClose = jest.fn();

    client.on(DumbClientEvents.Packet, onPacket);
    client.on(DumbClientEvents.Close, onClose);
    manual.on("close", onRemoteRxClose);
    manual.on("data", onRemoteRx);

    return { client, stream, algorithm, shell, manual, provider, onPacket, onClose, onRemoteRx, onRemoteRxClose };
}

describe("DumbClient", () => {
    it("creates packet on rx", () => {
        const { manual, onPacket } = makeNewDumbClient();
        const direct = new DirectStream();

        manual.write(
            Buffer.concat([
                direct.encode(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from("Hello, World!")])),
                Buffer.from([ControlCharacters.EndOfPacket])
            ])
        );

        expect(onPacket).toBeCalledTimes(1);
        expect(onPacket).toBeCalledWith(Packet.fromID(0xffff, Buffer.from("Hello, World!")));
    });

    it("local tx is transmitted as expected", () => {
        const { client, onRemoteRx } = makeNewDumbClient();
        const direct = new DirectStream();

        client.send(Packet.fromID(0xffff, Buffer.from("Hello, World!")));

        expect(onRemoteRx).toBeCalledTimes(1);
        expect(onRemoteRx).toBeCalledWith(
            Buffer.concat([
                direct.encode(Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from("Hello, World!")])),
                Buffer.from([ControlCharacters.EndOfPacket])
            ])
        );
    });

    describe("close", () => {
        it("from remote", () => {
            const { manual, onClose } = makeNewDumbClient();

            manual.close();

            expect(onClose).toBeCalledTimes(1);
        });
        it("commanded", () => {
            const { client, onRemoteRxClose } = makeNewDumbClient();

            client.close();

            expect(onRemoteRxClose).toBeCalledTimes(1);
        });
    });
});
