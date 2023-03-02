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

import RawShellAlgorithm from "../../../shell/algorithms/Raw";

test("RawShellAlgorithm", () => {
    const algorithm = new RawShellAlgorithm();
    const data = Buffer.from("Hello, world!");
    const packet = algorithm.encode(data);
    expect(packet).toEqual(data);
    const decoded = algorithm.decode(packet);
    expect(decoded).toEqual(data);
});
