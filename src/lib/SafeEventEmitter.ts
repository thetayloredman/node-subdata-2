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

import { EventEmitter } from "node:events";

// FIXME: This file has a whole lot of any. Can someone find a good way to fix this?
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Represents a type-safe EventEmitter. This is a wrapper around EventEmitter & should be
 * completely type-compatible with it.
 * @typeParam Events The types of events that can be emitted
 */
export default class SafeEventEmitter<Events extends Record<string, any[]>> implements EventEmitter {
    /** The underlying EventEmitter */
    private emitter: EventEmitter;

    public constructor() {
        this.emitter = new EventEmitter();
    }

    /**
     * Add a new listener. Works like EventEmitter#on().
     * @param event The event name to latch onto
     * @param listener The listener to call when the event is emitted
     * @returns This SafeEventEmitter
     */
    public on<Name extends keyof Events & string>(event: Name, listener: (...args: Events[Name]) => void): this {
        this.emitter.on(event, listener as any);
        return this;
    }

    /**
     * Add a new listener which can only fire once. Works like EventEmitter#once().
     * @param event The event name to latch onto
     * @param listener The listener to call when the event is emitted
     * @returns This SafeEventEmitter
     */
    public once<Name extends keyof Events & string>(event: Name, listener: (...args: Events[Name]) => void): this {
        this.emitter.once(event, listener as any);
        return this;
    }

    /**
     * Remove a listener. Works like EventEmitter#removeListener().
     * @param eventName The event name to remove the listener from
     * @param listener The listener to remove
     * @returns This SafeEventEmitter
     */
    public removeListener<Name extends keyof Events & string>(eventName: Name, listener: (...args: Events[Name]) => void): this {
        this.emitter.removeListener(eventName, listener as any);
        return this;
    }

    /**
     * Remove all listeners. Works like EventEmitter#removeAllListeners().
     * @param eventName The event name to remove all listeners from
     * @returns This SafeEventEmitter
     * @remarks If eventName is not provided, all listeners will be removed.
     */
    public removeAllListeners<Name extends keyof Events & string>(eventName?: Name): this {
        this.emitter.removeAllListeners(eventName as any);
        return this;
    }

    /**
     * Add a new listener. Works like EventEmitter#addListener().
     * @param eventName The event name to latch onto
     * @param listener The listener to call when the event is emitted
     * @returns This SafeEventEmitter
     */
    public addListener<Name extends keyof Events & string>(eventName: Name, listener: (...args: Events[Name]) => void): this {
        this.emitter.addListener(eventName, listener as any);
        return this;
    }

    /**
     * Set the maximum number of listeners before a warning is emitted. Works like EventEmitter#setMaxListeners().
     * @param n The new maximum number of listeners
     * @returns This SafeEventEmitter
     */
    public setMaxListeners(n: number): this {
        this.emitter.setMaxListeners(n);
        return this;
    }

    /**
     * Get the maximum number of listeners before a warning is emitted. Works like EventEmitter#getMaxListeners().
     * @returns The maximum number of listeners
     */
    public getMaxListeners(): number {
        return this.emitter.getMaxListeners();
    }

    /**
     * Get the listeners for an event. Works like EventEmitter#listeners().
     * @param event The event name to get the listeners for
     * @returns The listeners for the event
     */
    public listeners<Name extends keyof Events & string>(event: Name): Array<(...args: Events[Name]) => void> {
        return this.emitter.listeners(event as any) as any;
    }

    /**
     * Get the listeners for an event, including wrappers. Works like EventEmitter#rawListeners().
     * @param event The event name to get the listeners for
     * @returns The listeners for the event
     */
    public rawListeners<Name extends keyof Events & string>(event: Name): Array<(...args: Events[Name]) => void> {
        return this.emitter.rawListeners(event as any) as any;
    }

    /**
     * Get the number of listeners for an event. Works like EventEmitter#listenerCount().
     * @param event The event name to get the listener count for
     * @returns The number of listeners for the event
     */
    public listenerCount<Name extends keyof Events & string>(event: Name): number {
        return this.emitter.listenerCount(event as any);
    }

    /**
     * Prepend a new listener. Works like EventEmitter#prependListener().
     * @param event The event name to latch onto
     * @param listener The listener to call when the event is emitted
     * @returns This SafeEventEmitter
     */
    public prependListener<Name extends keyof Events & string>(event: Name, listener: (...args: Events[Name]) => void): this {
        this.emitter.prependListener(event, listener as any);
        return this;
    }

    /**
     * Prepend a new listener which can only fire once. Works like EventEmitter#prependOnceListener().
     * @param event The event name to latch onto
     * @param listener The listener to call when the event is emitted
     * @returns This SafeEventEmitter
     */
    public prependOnceListener<Name extends keyof Events & string>(event: Name, listener: (...args: Events[Name]) => void): this {
        this.emitter.prependOnceListener(event, listener as any);
        return this;
    }

    /**
     * Get all listened-to events. Works like EventEmitter#eventNames().
     * @returns An array of event names
     */
    public eventNames(): (string | symbol)[] {
        return this.emitter.eventNames();
    }

    /**
     * Remove a listener. Works like EventEmitter#off().
     * @param event The event name to remove the listener from
     * @param listener The listener to remove
     * @returns This SafeEventEmitter
     */
    public off<Name extends keyof Events & string>(event: Name, listener: (...args: Events[Name]) => void): this {
        this.emitter.removeListener(event, listener as any);
        return this;
    }

    /**
     * Emit an event. Works like EventEmitter#emit().
     * @param event The event name to emit
     * @param args The arguments to pass to the listeners
     * @returns Whether the event had listeners
     */
    public emit<Name extends keyof Events & string>(event: Name, ...args: Events[Name]): boolean {
        return this.emitter.emit(event, ...args);
    }
}
