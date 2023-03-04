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

import debug from "debug";
import { Emitter } from "strict-event-emitter";

import type Stream from "../stream";
import { StreamEvents } from "../stream";
import type ShellAlgorithm from "./algorithms/ShellAlgorithm";

const log = debug("node-subdata-2:shell");

export enum ShellEvents {
    /** Fired when a new packet is received */
    Packet = "packet",
    /** Fired after a Read Reset */
    Reset = "reset",
    /** Fired when the underlying {@link Stream} closes */
    Close = "close"
}
export type ShellEventArguments = {
    [ShellEvents.Packet]: [Buffer];
    [ShellEvents.Reset]: [];
    [ShellEvents.Close]: [];
};

/**
 * Represents and handles the {@link https://github.com/ME1312/SubData-2/wiki/Protocol-Format#layer-2-the-shell SubData 2 Shell}.
 * Given an {@link ShellAlgorithm}, call it with data, and hook onto an {@link Stream}.
 */
export default class Shell extends Emitter<ShellEventArguments> {
    private _algorithm: ShellAlgorithm;
    private _stream: Stream;

    public constructor(algorithm: ShellAlgorithm, stream: Stream) {
        super();
        log("initializing");
        this._algorithm = algorithm;
        this._stream = stream;
        this._stream.on(StreamEvents.Close, () => {
            log("forwarding close");
            this.emit(ShellEvents.Close);
        });
        this._stream.on(StreamEvents.Packet, (packet) => {
            log("forwarding+decoding packet", packet);
            this.emit(ShellEvents.Packet, this._algorithm.decode(packet));
        });
    }

    /** Send a packet. */
    public send(data: Buffer): void {
        log("encoding+sending packet", data);
        this._stream.writePacket(this._algorithm.encode(data));
    }

    /** Close the underlying connection. */
    public close(): void {
        log("closing");
        this._stream.close();
    }
}
