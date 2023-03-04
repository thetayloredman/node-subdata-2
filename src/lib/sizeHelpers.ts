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

// A series of helper functions for dealing with sizes (KB, GB, TB, etc.)

/**
 * Does literally nothing with the passed value.
 * @param size The size in bytes
 */
export function bytes(size: number): number {
    return size;
}

/**
 * Convert a size in kilobytes to bytes.
 * @param size The size in kilobytes
 */
export function kb(size: number): number {
    return size * 1024;
}

/**
 * Convert a size in megabytes to bytes.
 * @param size The size in megabytes
 */
export function mb(size: number): number {
    return kb(size) * 1024;
}

// TODO: Read GB (requires BigInt)
// TODO: Read TB (requires BigInt)
// TODO: Read PB (requires BigInt)
