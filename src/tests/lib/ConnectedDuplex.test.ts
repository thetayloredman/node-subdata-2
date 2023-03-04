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

import ConnectedDuplex from "../../lib/ConnectedDuplex";

function syncWrite(target: ConnectedDuplex, data: string): Promise<void> {
    return new Promise((resolve, reject) => {
        target.write(data, "utf-8", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

test("ConnectedDuplex", () => {
    const [a, b] = ConnectedDuplex.new();

    a.write("abc");
    expect(b.read()).toEqual(Buffer.from("abc"));
    b.write("def");
    expect(a.read()).toEqual(Buffer.from("def"));

    a.end();
    expect(b.read()).toBeNull();
});

test("flowing mode", async () => {
    const [a, b] = ConnectedDuplex.new();

    const aData = jest.fn();
    const bData = jest.fn();
    a.on("data", aData);
    b.on("data", bData);

    await syncWrite(a, "abc");
    await syncWrite(b, "def");

    expect(aData).toBeCalledTimes(1);
    expect(bData).toBeCalledTimes(1);
});
