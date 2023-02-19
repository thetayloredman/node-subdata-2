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

import { IOProviderEvents } from "../../../stream/providers/IOProvider";
import ManualIOProvider from "../../../stream/providers/ManualIOProvider";

/** Makes a new {@link ManualIOProvider} and attaches listeners */
function makeNewMIP(): {
    provider: ManualIOProvider;
    manual: ManualIOProvider["manual"];
    onDataReceived: jest.Mock;
    onCloseFromProvider: jest.Mock;
    onData: jest.Mock;
    onError: jest.Mock;
    onClose: jest.Mock;
} {
    const provider = new ManualIOProvider();
    const { manual } = provider;

    const onDataReceived = jest.fn();
    const onCloseFromProvider = jest.fn();
    const onData = jest.fn();
    const onError = jest.fn();
    const onClose = jest.fn();

    manual.on("data", onDataReceived);
    manual.on("close", onCloseFromProvider);
    provider.on(IOProviderEvents.Data, onData);
    provider.on(IOProviderEvents.Error, onError);
    provider.on(IOProviderEvents.Close, onClose);

    return { provider, manual, onDataReceived, onData, onError, onClose, onCloseFromProvider };
}

describe("ManualIOProvider", () => {
    it("works as expected", () => {
        const { provider, manual, onDataReceived, onData } = makeNewMIP();

        manual.write(Buffer.from("Hello, world!"));

        expect(onData).toHaveBeenCalledTimes(1);
        expect(onData).toHaveBeenCalledWith(Buffer.from("Hello, world!"));

        provider.write(Buffer.from("Hello, World! #2"));

        expect(onDataReceived).toHaveBeenCalledTimes(1);
        expect(onDataReceived).toHaveBeenCalledWith(Buffer.from("Hello, World! #2"));
        expect(onData).toHaveBeenCalledTimes(1);
    });

    it("close from provider side", () => {
        const { provider, onCloseFromProvider } = makeNewMIP();

        provider.close();

        expect(onCloseFromProvider).toHaveBeenCalledTimes(1);
    });

    it("close from remote side", () => {
        const { manual, onClose } = makeNewMIP();

        manual.close();
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("error handled", () => {
        const { manual, onError } = makeNewMIP();

        const error = new Error("Test error");
        manual.error(error);

        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(error);
    });
});
