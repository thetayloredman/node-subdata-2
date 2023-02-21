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

import { Emitter } from "strict-event-emitter";

import type IOProvider from "./IOProvider";
import type { IOProviderEventArguments } from "./IOProvider";
import { IOProviderEvents } from "./IOProvider";

/**
 * An {@link IOProvider} that has manual writing functions, used in testing.
 *
 * **You probably do not want to use this.** This should only be used in unit tests for SD2. We will not
 * support use-cases that involve this provider.
 */
export default class ManualIOProvider extends Emitter<IOProviderEventArguments> implements IOProvider {
    /** Functions for reading/writing */
    public manual: Emitter<{ data: [Buffer]; close: [] }> & {
        write: (data: Buffer) => void;
        close: () => void;
        error: (error: Error) => void;
    };

    public constructor() {
        super();
        this.manual = Object.assign(new Emitter<{ data: [Buffer]; close: [] }>(), {
            write: (data: Buffer): void => {
                this.emit(IOProviderEvents.Data, data);
            },
            close: (): void => {
                this.emit(IOProviderEvents.Close);
            },
            error: (error: Error): void => {
                this.emit(IOProviderEvents.Error, error);
            }
        });
    }

    /** Write new data to this IOProvider */
    public write(data: Buffer): void {
        this.manual.emit("data", data);
    }

    /** Close this IOProvider */
    public close(): void {
        this.manual.emit("close");
    }
}
