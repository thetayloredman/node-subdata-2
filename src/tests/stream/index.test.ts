/*
 * node-subdata-2 - SubData 2 wrapper for Node.js
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
    onRemoteRxClose: jest.Mock;
    onRemoteRx: jest.Mock;
    onLocalRxClose: jest.Mock;
} {
    const [local, remote] = ConnectedDuplex.new();
    const stream = new Stream(local);

    const onRemoteRx = jest.fn();
    const onRemoteRxClose = jest.fn();
    const onLocalRxClose = jest.fn();
    const onReset = jest.fn();
    const onPacket = jest.fn();
    const onRead = jest.fn();

    remote.on("data", onRemoteRx);
    remote.on("close", onRemoteRxClose);
    stream.on(StreamEvents.Close, onLocalRxClose);
    stream.on(StreamEvents.Reset, onReset);
    stream.on(StreamEvents.Packet, onPacket);
    stream.on(StreamEvents.Read, onRead);

    return { local, remote, stream, onPacket, onReset, onRead, onRemoteRxClose, onRemoteRx, onLocalRxClose };
}

const encodeMock = jest.spyOn(DirectStream.prototype, "encode");

beforeEach(() => {
    encodeMock.mockClear();
});

function charCode(char: string): number {
    return char.charCodeAt(0);
}

describe("Stream", () => {
    it("properly encodes when writing", async () => {
        const { stream, onRemoteRx } = makeNewStream();

        await stream.write(Buffer.from("Hello, World!"));

        expect(encodeMock).toHaveBeenCalledWith(Buffer.from("Hello, World!"));
        expect(onRemoteRx).toHaveBeenCalledWith(
            Buffer.from([
                ControlCharacters.ReadBytes,
                2, // 4(2+1) = 12
                charCode("H"),
                charCode("e"),
                charCode("l"),
                charCode("l"),
                charCode("o"),
                charCode(","),
                charCode(" "),
                charCode("W"), // 8th byte
                charCode("o"),
                charCode("r"),
                charCode("l"),
                charCode("d"), // 12th byte
                ControlCharacters.ReadByte,
                charCode("!")
            ])
        );
    });

    // it("properly decodes when receiving", () => {
    //     const { manual, onPacket } = makeNewStream();

    //     manual.write(
    //         Buffer.from([
    //             ControlCharacters.ReadBytes,
    //             2, // 4(2+1) = 12
    //             charCode("H"),
    //             charCode("e"),
    //             charCode("l"),
    //             charCode("l"),
    //             charCode("o"),
    //             charCode(","),
    //             charCode(" "),
    //             charCode("W"), // 8th byte
    //             charCode("o"),
    //             charCode("r"),
    //             charCode("l"),
    //             charCode("d"), // 12th byte
    //             ControlCharacters.ReadByte,
    //             charCode("!"),
    //             ControlCharacters.EndOfPacket
    //         ])
    //     );

    //     expect(onPacket).toBeCalledTimes(1);
    //     expect(onPacket).toBeCalledWith(Buffer.from("Hello, World!"));
    // });

    // it("emits Reset when a remote read reset is encountered and does discard the packet so far", () => {
    //     const { manual, onPacket, onRead, onReset } = makeNewStream();

    //     manual.write(
    //         Buffer.from([
    //             ControlCharacters.ReadBytes,
    //             2, // 4(2+1) = 12
    //             charCode("H"),
    //             charCode("e"),
    //             charCode("l"),
    //             charCode("l"),
    //             charCode("o"),
    //             charCode(","),
    //             charCode(" "),
    //             charCode("W"), // 8th byte
    //             charCode("o"),
    //             charCode("r"),
    //             charCode("l"),
    //             charCode("d"), // 12th byte
    //             ControlCharacters.ReadByte,
    //             charCode("!")
    //         ])
    //     );

    //     expect(onPacket).toBeCalledTimes(0);
    //     expect(onRead).toBeCalledTimes(2);
    //     expect(onRead).toHaveBeenNthCalledWith(1, Buffer.from("Hello, World"));
    //     expect(onRead).toHaveBeenNthCalledWith(2, Buffer.from("!"));

    //     manual.write(Buffer.from([ControlCharacters.ReadReset]));

    //     expect(onReset).toBeCalledTimes(1);
    //     expect(onPacket).toBeCalledTimes(0);
    //     expect(onRead).toBeCalledTimes(2);

    //     manual.write(Buffer.from([ControlCharacters.EndOfPacket]));

    //     expect(onReset).toBeCalledTimes(1);
    //     expect(onPacket).toBeCalledTimes(1);
    //     expect(onPacket).toBeCalledWith(Buffer.alloc(0));
    //     expect(onRead).toBeCalledTimes(2);
    // });

    // it("can terminate packets", () => {
    //     const { stream, onRemoteReceiveData } = makeNewStream();

    //     stream.write(Buffer.from("A"));
    //     stream.endPacket();

    //     expect(onRemoteReceiveData).toBeCalledTimes(2);
    //     expect(onRemoteReceiveData).toHaveBeenNthCalledWith(1, Buffer.from([ControlCharacters.ReadByte, charCode("A")]));
    //     expect(onRemoteReceiveData).toHaveBeenNthCalledWith(2, Buffer.from([ControlCharacters.EndOfPacket]));
    // });

    // it("writePacket will also do the same thing", () => {
    //     const { stream, onRemoteReceiveData } = makeNewStream();

    //     stream.writePacket(Buffer.from("A"));

    //     expect(onRemoteReceiveData).toBeCalledTimes(1);
    //     expect(onRemoteReceiveData).toHaveBeenCalledWith(Buffer.from([ControlCharacters.ReadByte, charCode("A"), ControlCharacters.EndOfPacket]));
    // });

    // it("can transmit read reset", () => {
    //     const { stream, onRemoteReceiveData } = makeNewStream();

    //     stream.write(Buffer.from("A"));
    //     stream.readReset();

    //     expect(onRemoteReceiveData).toBeCalledTimes(2);
    //     expect(onRemoteReceiveData).toHaveBeenNthCalledWith(1, Buffer.from([ControlCharacters.ReadByte, charCode("A")]));
    //     expect(onRemoteReceiveData).toHaveBeenNthCalledWith(2, Buffer.from([ControlCharacters.ReadReset]));
    // });

    // describe("close", () => {
    //     it("received from remote", () => {
    //         const { manual, onClose } = makeNewStream();

    //         manual.close();

    //         expect(onClose).toBeCalledTimes(1);
    //     });

    //     it("sent from local", () => {
    //         const { stream, onRemoteReceiveClose } = makeNewStream();

    //         stream.close();

    //         expect(onRemoteReceiveClose).toBeCalledTimes(1);
    //     });
    // });
});
