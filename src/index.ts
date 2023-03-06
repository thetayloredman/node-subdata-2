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

import { InitialProtocolPackets, ProtocolPackets, ProtocolStates } from "./client/states";
import DumbClient, { DumbClientEventArguments, DumbClientEvents } from "./DumbClient";
import { bytes, kb, mb } from "./lib/sizeHelpers.js";
import Packet from "./Packet";
import Shell, { ShellEventArguments, ShellEvents } from "./shell/";
import RawShellAlgorithm from "./shell/algorithms/Raw.js";
import ShellAlgorithm from "./shell/algorithms/ShellAlgorithm.js";
import Stream, { StreamEventArguments, StreamEvents } from "./stream/";
import { ControlCharacters, SizedControlCharacters } from "./stream/controlCharacters.js";
import DirectStream, { DirectStreamEventArguments, DirectStreamEvents } from "./stream/DirectStream.js";

export {
    bytes,
    ControlCharacters,
    // eslint-disable-next-line deprecation/deprecation
    DirectStream,
    DirectStreamEventArguments,
    DirectStreamEvents,
    DumbClient,
    DumbClientEventArguments,
    DumbClientEvents,
    InitialProtocolPackets,
    kb,
    mb,
    Packet,
    ProtocolPackets,
    ProtocolStates,
    RawShellAlgorithm,
    Shell,
    ShellAlgorithm,
    ShellEventArguments,
    ShellEvents,
    SizedControlCharacters,
    Stream,
    StreamEventArguments,
    StreamEvents
};
