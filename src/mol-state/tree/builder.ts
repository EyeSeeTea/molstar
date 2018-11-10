/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { StateTree } from './immutable';
import { TransientTree } from './transient';
import { StateObject } from '../object';
import { Transform } from '../transform';
import { Transformer } from '../transformer';
import { shallowEqual } from 'mol-util';

export { StateTreeBuilder }

interface StateTreeBuilder {
    getTree(): StateTree
}

namespace StateTreeBuilder {
    interface State {
        tree: TransientTree
    }

    export function is(obj: any): obj is StateTreeBuilder {
        return !!obj && typeof (obj as StateTreeBuilder).getTree === 'function';
    }

    export class Root implements StateTreeBuilder {
        private state: State;
        to<A extends StateObject>(ref: Transform.Ref) { return new To<A>(this.state, ref, this); }
        toRoot<A extends StateObject>() { return new To<A>(this.state, this.state.tree.root.ref, this); }
        delete(ref: Transform.Ref) {
            this.state.tree.remove(ref);
            return this;
        }
        getTree(): StateTree { return this.state.tree.asImmutable(); }
        constructor(tree: StateTree) { this.state = { tree: tree.asTransient() } }
    }

    export class To<A extends StateObject> implements StateTreeBuilder {
        apply<T extends Transformer<A, any, any>>(tr: T, params?: Transformer.Params<T>, props?: Partial<Transform.Options>): To<Transformer.To<T>> {
            const t = tr.apply(this.ref, params, props);
            this.state.tree.add(t);
            return new To(this.state, t.ref, this.root);
        }

        update<T extends Transformer<A, any, any>>(transformer: T, params: (old: Transformer.Params<T>) => Transformer.Params<T>): Root
        update(params: any): Root
        update<T extends Transformer<A, any, any>>(paramsOrTransformer: T, provider?: (old: Transformer.Params<T>) => Transformer.Params<T>) {
            const old = this.state.tree.nodes.get(this.ref)!;
            let params: any;
            if (provider) {
                params = provider(old.params as any);
            } else {
                params = paramsOrTransformer;
            }

            if (old.transformer.definition.params && old.transformer.definition.params.areEqual) {
                if (old.transformer.definition.params.areEqual(old.params, params)) return this.root;
            } else {
                if (shallowEqual(old.params, params)) {
                    return this.root;
                }
            }

            this.state.tree.set(Transform.updateParams(old, params));
            return this.root;
        }

        and() { return this.root; }

        getTree(): StateTree { return this.state.tree.asImmutable(); }

        constructor(private state: State, private ref: Transform.Ref, private root: Root) {
            if (!this.state.tree.nodes.has(ref)) {
                throw new Error(`Could not find node '${ref}'.`);
            }
        }
    }
}