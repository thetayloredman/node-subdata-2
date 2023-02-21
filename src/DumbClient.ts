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

import debug from "debug";

import SafeEventEmitter from "./lib/SafeEventEmitter";
import Packet from "./Packet";
import type Shell from "./shell";
import { ShellEvents } from "./shell";

const log = debug("node-subdata-2:DumbClient");

/** A list of possible events for a {@link DumbClient} */
export enum DumbClientEvents {
    /** A new packet is received */
    Packet = "packet",
    /** The connection is closing */
    Close = "close"
}

export type DumbClientEventArguments = {
    [DumbClientEvents.Packet]: [Packet];
    [DumbClientEvents.Close]: [];
};

/**
 * Represents a SubData 2 client that does not perform any protocol
 * handshake or states, and leaves it up to the user. You probably
 * don't want to use this.
 */
export default class DumbClient extends SafeEventEmitter<DumbClientEventArguments> {
    private _shell: Shell;

    /**
     * Create a new DumbClient.
     * @param shell The {@link Shell} to use
     */
    public constructor(shell: Shell) {
        super();
        log("initializing");
        this._shell = shell;
        this._shell.on(ShellEvents.Close, () => {
            log("forwarding close");
            this.emit(DumbClientEvents.Close);
        });
        this._shell.on(ShellEvents.Packet, (_size, data) => {
            log("forwarding packet", data);
            this.emit(DumbClientEvents.Packet, new Packet(data));
        });
    }

    /**
     * Terminate the TCP level of the connection. This does not send the disconnect packets.
     */
    public close() {
        log("triggering close");
        this._shell.close();
    }

    /** Send a {@link Packet} over the stream. */
    public send(data: Packet) {
        log("sending packet", data);
        this._shell.send(data.toRaw());
    }
}
