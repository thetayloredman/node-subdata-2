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

import type { NetConnectOpts } from "node:net";
import { type Socket, createConnection } from "node:net";

import debug from "debug";
import { Emitter } from "strict-event-emitter";

import type IOProvider from "./IOProvider";
import type { IOProviderEventArguments } from "./IOProvider";
import { IOProviderEvents } from "./IOProvider";

const log = debug("node-subdata-2:stream:providers:TCPIOProvider");

/**
 * A simple {@link IOProvider} for TCP connections
 */
export default class TCPIOProvider extends Emitter<IOProviderEventArguments> implements IOProvider {
    /** The underlying TCP connection */
    private _socket: Socket;

    public constructor(options: NetConnectOpts) {
        super();
        this._socket = createConnection(options);
        log("now listening");
        this._socket.on("data", this._handleData).on("close", this._handleClose);
    }

    /** Write new data to this IOProvider */
    public write(data: Buffer): void {
        log("tx", data);
        this._socket.write(data);
    }

    /** Handle new data from the underlying connection */
    private _handleData(data: Buffer): void {
        log("rx", data);
        this.emit(IOProviderEvents.Data, data);
    }

    /** Handle the underlying connection being closed */
    private _handleClose(): void {
        log("Received close");
        this.emit(IOProviderEvents.Close);
    }

    /** Close the underlying connection */
    public close(): void {
        log("Commanded close");
        this._socket.end();
    }
}
