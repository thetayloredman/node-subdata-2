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
import DirectStream, { DirectStreamEvents } from "./DirectStream";
import type IOProvider from "./providers/IOProvider";
import { IOProviderEvents } from "./providers/IOProvider";

export enum StreamEvents {
    Read = "read",
    Packet = "packet",
    Reset = "reset",
    Close = "close"
}

export type StreamEventArguments = {
    [StreamEvents.Read]: [Buffer];
    [StreamEvents.Packet]: [number, Buffer];
    [StreamEvents.Reset]: [];
    [StreamEvents.Close]: [];
};

export default class Stream extends SafeEventEmitter<StreamEventArguments> {
    private _provider: IOProvider;
    private _stream: DirectStream;

    /** @param provider The underlying {@link IOProvider} to use */
    public constructor(provider: IOProvider) {
        super();
        this._provider = provider;
        this._stream = new DirectStream();
        this._provider.on(IOProviderEvents.Data, (data) => {
            this._stream.feed(data);
        });
        this._stream.on(DirectStreamEvents.ReadReset, () => {
            this.emit(StreamEvents.Reset);
        });
        this._stream.on(DirectStreamEvents.Read, (_size, _count, data) => {
            this.emit(StreamEvents.Read, data instanceof Buffer ? data : Buffer.from([data]));
        });
        this._stream.on(DirectStreamEvents.Packet, (size, data) => {
            this.emit(StreamEvents.Packet, size, data);
        });
        this._provider.on(IOProviderEvents.Close, () => {
            this.emit(StreamEvents.Close);
        });
    }
}
