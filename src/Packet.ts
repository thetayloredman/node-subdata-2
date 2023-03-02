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

import debug from "debug";

const log = debug("node-subdata-2:Packet");

/** Describes a SubData 2 packet. */
export default class Packet {
    /** This packet's identification number */
    public id: number;
    /** The rest of the packet's InputStream */
    public data: Buffer;

    /**
     * Create a new Packet.
     * @param raw The raw packet data including the ID as the first two bytes
     */
    public constructor(raw: Buffer) {
        this.id = parseInt(raw.subarray(0, 2).toString("hex"), 16);
        this.data = raw.subarray(2);
        log("new packet with id", this.id, "and data", this.data);
    }

    /** Convert this Packet to raw network data */
    public toRaw() {
        const result = Buffer.concat([Buffer.from([this.id >> 8, this.id & 0xff]), this.data]);
        log("converting packet with id", this.id.toString(16), "and data", this.data, "to raw", result);
        return result;
    }

    /** Make a new Packet given an ID and data. */
    public static fromID(id: number, data: Buffer) {
        log("from id", id.toString(16), "and data", data);
        return new Packet(Buffer.concat([Buffer.from([id >> 8, id & 0xff]), data]));
    }
}
