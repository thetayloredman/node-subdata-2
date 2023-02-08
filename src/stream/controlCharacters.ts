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

/** List of all of the {@link https://github.com/ME1312/SubData-2/wiki/Protocol-Format#layer-1-the-stream control characters} in the SubData 2 protocol. */
enum ControlCharacters {
    /** **Keep-Alive**: This control character does literally nothing */
    KEEP_ALIVE = 0x00,
    /** **Read Byte**: Does not parse the following byte for a control character */
    READ_BYTE = 0x10,
    /** **Read Bytes**: Does not parse the following `4x` bytes for control characters */
    READ_BYTES = 0x11,
    /** **Read KB**: Does not parse the following `4x` kilobytes for control characters */
    READ_KB = 0x12,
    /** **Read MB**: Does not parse the following `4x` megabytes for control characters */
    READ_MB = 0x13,
    /** **Read GB**: Does not parse the following `4x` gigabytes for control characters */
    READ_GB = 0x14,
    /** **Read TB**: Does not parse the following `4x` terabytes for control characters */
    READ_TB = 0x15,
    /** **Read PB**: Does not parse the following `4x` petabytes for control characters */
    READ_PB = 0x16,
    /** **End of Packet**: Signals the end of a packet */
    END_OF_PACKET = 0x17,
    /** **Read Reset**: Invalidates any data before this (if possible) and resets */
    READ_RESET = 0x18
}

export { ControlCharacters };
