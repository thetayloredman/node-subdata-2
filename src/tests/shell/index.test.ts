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

import Shell, { ShellEvents } from "../../shell";
import RawShellAlgorithm from "../../shell/algorithms/Raw";
import Stream from "../../stream";
import { ControlCharacters } from "../../stream/controlCharacters";
import DirectStream from "../../stream/DirectStream";
import ManualIOProvider from "../../stream/providers/ManualIOProvider";

function makeNewShell(): {
    algorithm: RawShellAlgorithm;
    provider: ManualIOProvider;
    manual: ManualIOProvider["manual"];
    stream: Stream;
    shell: Shell;
    remoteRx: jest.Mock;
    localPacket: jest.Mock;
    localRxClose: jest.Mock;
    remoteRxClose: jest.Mock;
} {
    const algorithm = new RawShellAlgorithm();
    const provider = new ManualIOProvider();
    const { manual } = provider;
    const stream = new Stream(provider);
    const shell = new Shell(algorithm, stream);

    const remoteRx = jest.fn();
    const localPacket = jest.fn();
    const localRxClose = jest.fn();
    const remoteRxClose = jest.fn();

    manual.on("data", remoteRx);
    manual.on("close", remoteRxClose);
    shell.on(ShellEvents.Packet, localPacket);
    shell.on(ShellEvents.Close, localRxClose);

    return { algorithm, provider, manual, stream, shell, remoteRx, localPacket, localRxClose, remoteRxClose };
}

describe("Shell", () => {
    it("simple transmit", () => {
        const { shell, remoteRx, localPacket } = makeNewShell();
        const direct = new DirectStream();
        const data = Buffer.from("Hello, world!");

        shell.send(data);

        expect(remoteRx).toBeCalledTimes(1);
        expect(remoteRx).toBeCalledWith(Buffer.concat([direct.encode(data), Buffer.from([ControlCharacters.EndOfPacket])]));
        expect(localPacket).toBeCalledTimes(0);
    });

    it("simple receive", () => {
        const { manual, localPacket } = makeNewShell();
        const direct = new DirectStream();
        const data = Buffer.from("Hello, World!");

        manual.write(Buffer.concat([direct.encode(data), Buffer.from([ControlCharacters.EndOfPacket])]));

        expect(localPacket).toBeCalledTimes(1);
        expect(localPacket).toBeCalledWith(data);
    });

    describe("close", () => {
        it("from remote", () => {
            const { manual, localRxClose } = makeNewShell();

            manual.close();

            expect(localRxClose).toBeCalledTimes(1);
        });

        it("from local", () => {
            const { shell, remoteRxClose } = makeNewShell();

            shell.close();

            expect(remoteRxClose).toBeCalledTimes(1);
        });
    });
});
