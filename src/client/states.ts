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

/** Represents all of the protocol-level packets that may be sent/received before the Ready state is hit */
export enum InitialProtocolPackets {
    InitPacketDeclaration = 0x0000,
    InitPacketChangeEncryption = 0x0001,
    InitPacketPostDeclaration = 0x0002,
    InitPacketLogin = 0x0003,
    InitPacketVerifyState = 0xfffa,
    InitPacketChangeState = 0xfffb,
    PacketNull = 0xfffd,
    PacketDisconnectUnderstood = 0xfffe,
    PacketDisconnect = 0xffff
}

/** Represents all of the protocol-level packets that may be sent/received in the Ready state */
export enum ProtocolPackets {
    PacketDownloadClientList = 0xfff6,
    PacketOpenChannel = 0xfff7,
    PacketPingResponse = 0xfff8,
    PacketPing = 0xfff9,
    InitPacketVerifyState = 0xfffa,
    // Typo was made in the docs too, so we're stuck with it.
    PacketRecieveMessage = 0xfffb,
    PacketForwardPacket = 0xfffc,
    PacketNull = 0xfffd,
    PacketDisconnectUnderstood = 0xfffe,
    PacketDisconnect = 0xffff
}

/** Represents all possible protocol states */
export enum ProtocolStates {
    /** {@link https://github.com/ME1312/SubData-2/wiki/Protocol-States#pre_initialization PRE_INITIALIZATION on the SubData Documentation} */
    PreInitialization,
    /** {@link https://github.com/ME1312/SubData-2/wiki/Protocol-States#initialization INITIALIZATION on the SubData Documentation} */
    Initialization,
    /** {@link https://github.com/ME1312/SubData-2/wiki/Protocol-States#post_initialization POST_INITIALIZATION on the SubData Documentation} */
    PostInitialization,
    /** {@link https://github.com/ME1312/SubData-2/wiki/Protocol-States#ready READY on the SubData Documentation} */
    Ready,
    /** {@link https://github.com/ME1312/SubData-2/wiki/Protocol-States#closing CLOSING on the SubData Documentation} */
    Closing,
    /** {@link https://github.com/ME1312/SubData-2/wiki/Protocol-States#closed CLOSED on the SubData Documentation} */
    Closed
}
