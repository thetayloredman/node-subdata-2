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

import type SafeEventEmitter from "../../lib/SafeEventEmitter";

/** The list of possible events that an {@link IOProvider} can emit */
export enum IOProviderEvents {
    Data = "data",
    Error = "error",
    Close = "close"
}

/** The list of and arguments for all events that an {@link IOProvider} can emit */
export type IOProviderEventArguments = {
    [IOProviderEvents.Data]: [Buffer];
    [IOProviderEvents.Error]: [Error];
    [IOProviderEvents.Close]: [];
};

/** Abstract interface that represents something that performs I/O, likely for a {@link Stream} */
export default interface IOProvider extends SafeEventEmitter<IOProviderEventArguments> {
    /** Write new data to the underlying connection */
    write(data: Buffer): void;
}
