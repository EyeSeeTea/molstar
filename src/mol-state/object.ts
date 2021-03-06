/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { UUID } from '../mol-util';
import { StateTransform } from './transform';
import { ParamDefinition } from '../mol-util/param-definition';
import { State } from './state';
import { StateSelection, StateTransformer } from '../mol-state';

export { StateObject, StateObjectCell }

interface StateObject<D = any, T extends StateObject.Type = StateObject.Type<any>> {
    readonly id: UUID,
    readonly type: T,
    readonly data: D,
    readonly label: string,
    readonly description?: string,
    // assigned by reconciler to be StateTransform.props.tag
    readonly tags?: string[]
}

namespace StateObject {
    export function factory<T extends Type>() {
        return <D = { }>(type: T) => create<D, T>(type);
    }

    export type Type<Cls extends string = string> = { name: string, typeClass: Cls }
    export type Ctor<T extends StateObject = StateObject> = { new(...args: any[]): T, type: any }
    export type From<C extends Ctor> = C extends Ctor<infer T> ? T : never

    export function create<Data, T extends Type>(type: T) {
        return class O implements StateObject<Data, T> {
            static type = type;
            static is(obj?: StateObject): obj is O { return !!obj && type === obj.type; }
            id = UUID.create22();
            type = type;
            label: string;
            description?: string;
            constructor(public data: Data, props?: { label: string, description?: string }) {
                this.label = props && props.label || type.name;
                this.description = props && props.description;
            }
        }
    }

    /** A special object indicating a transformer result has no value. */
    export const Null: StateObject<any, any> = {
        id: UUID.create22(),
        type: { name: 'Null', typeClass: 'Null' },
        data: void 0,
        label: 'Null'
    };
}

interface StateObjectCell<T extends StateObject = StateObject, F extends StateTransform<StateTransformer<any, T, any>> = StateTransform<StateTransformer<any, T, any>>> {
    parent: State,

    transform: F,

    // Which object was used as a parent to create data in this cell
    sourceRef: StateTransform.Ref | undefined,

    status: StateObjectCell.Status,
    state: StateTransform.State,

    params: {
        definition: ParamDefinition.Params,
        values: any
    } | undefined;

    errorText?: string,
    obj?: T,

    cache: unknown | undefined
}

namespace StateObjectCell {
    export type Status = 'ok' | 'error' | 'pending' | 'processing'

    export type Obj<C extends StateObjectCell> = C extends StateObjectCell<infer T> ? T : never
    export type Transform<C extends StateObjectCell> = C extends StateObjectCell<any, infer T> ? T : never
}

// TODO: improve the API?
export class StateObjectTracker<T extends StateObject> {
    private query: StateSelection.Query;
    private version: string = '';
    cell: StateObjectCell | undefined;
    data: T['data'] | undefined;

    setQuery(sel: StateSelection.Selector) {
        this.query = StateSelection.compile(sel);
    }

    update() {
        const cell = this.state.select(this.query)[0];
        const version = cell ? cell.transform.version : void 0;
        const changed = this.cell !== cell || this.version !== version;
        this.cell = cell;
        this.version = version || '';
        this.data = cell && cell.obj ? cell.obj.data as T : void 0 as any;
        return changed;
    }

    constructor(private state: State) { }
}