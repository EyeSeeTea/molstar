/**
 * Copyright (c) 2018-2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import * as React from 'react'
import { PluginUIComponent } from './base';
import { PluginStateObject as PSO } from '../state/objects';
import { Sequence } from './sequence/sequence';
import { Structure, StructureElement, StructureProperties as SP, Unit } from '../../mol-model/structure';
import { SequenceWrapper } from './sequence/wrapper';
import { PolymerSequenceWrapper } from './sequence/polymer';
import { StructureElementSelectionManager } from '../util/structure-element-selection';
import { MarkerAction } from '../../mol-util/marker-action';
import { ParameterControls } from './controls/parameters';
import { ParamDefinition as PD } from '../../mol-util/param-definition';
import { HeteroSequenceWrapper } from './sequence/hetero';
import { State, StateSelection } from '../../mol-state';
import { ChainSequenceWrapper } from './sequence/chain';
import { ElementSequenceWrapper } from './sequence/element';
import { elementLabel } from '../../mol-theme/label';

const MaxDisplaySequenceLength = 5000

function opKey(l: StructureElement.Location) {
    const ids = SP.unit.pdbx_struct_oper_list_ids(l)
    const ncs = SP.unit.struct_ncs_oper_id(l)
    const hkl = SP.unit.hkl(l)
    const spgrOp = SP.unit.spgrOp(l)
    return `${ids.sort().join(',')}|${ncs}|${hkl}|${spgrOp}`
}

function splitModelEntityId(modelEntityId: string) {
    const [ modelIdx, entityId ] = modelEntityId.split('|')
    return [ parseInt(modelIdx), entityId ]
}

function getSequenceWrapper(state: SequenceViewState, structureSelection: StructureElementSelectionManager): SequenceWrapper.Any | string {
    const { structure, modelEntityId, chainGroupId, operatorKey } = state
    const l = StructureElement.Location.create()
    const [ modelIdx, entityId ] = splitModelEntityId(modelEntityId)

    const units: Unit[] = []

    for (const unit of structure.units) {
        StructureElement.Location.set(l, unit, unit.elements[0])
        if (structure.getModelIndex(unit.model) !== modelIdx) continue
        if (SP.entity.id(l) !== entityId) continue
        if (unit.chainGroupId !== chainGroupId) continue
        if (opKey(l) !== operatorKey) continue

        units.push(unit)
    }

    if (units.length > 0) {
        const data = { structure, units }
        const unit = units[0]

        let sw: SequenceWrapper<any>
        if (unit.polymerElements.length) {
            const l = StructureElement.Location.create(unit, unit.elements[0])
            const entitySeq = unit.model.sequence.byEntityKey[SP.entity.key(l)]
            // check if entity sequence is available
            if (entitySeq && entitySeq.sequence.length <= MaxDisplaySequenceLength) {
                sw = new PolymerSequenceWrapper(data)
            } else {
                if (Unit.isAtomic(unit) || unit.polymerElements.length > MaxDisplaySequenceLength) {
                    sw = new ChainSequenceWrapper(data)
                } else {
                    sw = new ElementSequenceWrapper(data)
                }
            }
        } else if (Unit.isAtomic(unit)) {
            if (unit.residueCount > MaxDisplaySequenceLength) {
                sw = new ChainSequenceWrapper(data)
            } else {
                sw = new HeteroSequenceWrapper(data)
            }
        } else {
            console.warn('should not happen, expecting coarse units to be polymeric')
            sw = new ChainSequenceWrapper(data)
        }

        sw.markResidue(structureSelection.get(structure), MarkerAction.Select)
        return sw
    } else {
        return 'No sequence available'
    }
}

function getModelEntityOptions(structure: Structure) {
    const options: [string, string][] = []
    const l = StructureElement.Location.create()
    const seen = new Set<string>()

    for (const unit of structure.units) {
        StructureElement.Location.set(l, unit, unit.elements[0])
        const id = SP.entity.id(l)
        const modelIdx = structure.getModelIndex(unit.model)
        const key = `${modelIdx}|${id}`
        if (seen.has(key)) continue

        let description = SP.entity.pdbx_description(l).join(', ')
        if (structure.models.length) {
            if (structure.representativeModel) { // indicates model trajectory
                description += ` (Model ${structure.models[modelIdx].modelNum})`
            } else  if (description.startsWith('Polymer ')) { // indicates generic entity name
                description += ` (${structure.models[modelIdx].entry})`
            }
        }
        const label = `${id}: ${description}`
        options.push([ key, label ])
        seen.add(key)
    }

    if (options.length === 0) options.push(['', 'No entities'])
    return options
}

function getChainOptions(structure: Structure, modelEntityId: string) {
    const options: [number, string][] = []
    const l = StructureElement.Location.create()
    const seen = new Set<number>()
    const [ modelIdx, entityId ] = splitModelEntityId(modelEntityId)

    for (const unit of structure.units) {
        StructureElement.Location.set(l, unit, unit.elements[0])
        if (structure.getModelIndex(unit.model) !== modelIdx) continue
        if (SP.entity.id(l) !== entityId) continue

        const id = unit.chainGroupId
        if (seen.has(id)) continue

        // TODO handle special case
        // - more than one chain in a unit
        let label = elementLabel(l, { granularity: 'chain', hidePrefix: true, htmlStyling: false })

        options.push([ id, label ])
        seen.add(id)
    }

    if (options.length === 0) options.push([-1, 'No units'])
    return options
}

function getOperatorOptions(structure: Structure, modelEntityId: string, chainGroupId: number) {
    const options: [string, string][] = []
    const l = StructureElement.Location.create()
    const seen = new Set<string>()
    const [ modelIdx, entityId ] = splitModelEntityId(modelEntityId)

    for (const unit of structure.units) {
        StructureElement.Location.set(l, unit, unit.elements[0])
        if (structure.getModelIndex(unit.model) !== modelIdx) continue
        if (SP.entity.id(l) !== entityId) continue
        if (unit.chainGroupId !== chainGroupId) continue

        const id = opKey(l)
        if (seen.has(id)) continue

        const label = unit.conformation.operator.name
        options.push([ id, label ])
        seen.add(id)
    }

    if (options.length === 0) options.push(['', 'No operators'])
    return options
}

function getStructureOptions(state: State) {
    const options: [string, string][] = []

    const structures = state.select(StateSelection.Generators.rootsOfType(PSO.Molecule.Structure))
    for (const s of structures) {
        options.push([s.transform.ref, s.obj!.data.label])
    }

    if (options.length === 0) options.push(['', 'No structure'])
    return options
}

type SequenceViewState = {
    structure: Structure,
    structureRef: string,
    modelEntityId: string,
    chainGroupId: number,
    operatorKey: string
}

export class SequenceView extends PluginUIComponent<{ }, SequenceViewState> {
    state = { structure: Structure.Empty, structureRef: '', modelEntityId: '', chainGroupId: -1, operatorKey: '' }

    componentDidMount() {
        if (this.plugin.state.dataState.select(StateSelection.Generators.rootsOfType(PSO.Molecule.Structure)).length > 0) this.setState(this.getInitialState())

        this.subscribe(this.plugin.events.state.object.updated, ({ ref, obj }) => {
            if (ref === this.state.structureRef && obj && obj.type === PSO.Molecule.Structure.type && obj.data !== this.state.structure) {
                this.setState(this.getInitialState())
            }
        });

        this.subscribe(this.plugin.events.state.object.created, ({ obj }) => {
            if (obj && obj.type === PSO.Molecule.Structure.type) {
                this.setState(this.getInitialState())
            }
        });

        this.subscribe(this.plugin.events.state.object.removed, ({ obj }) => {
            if (obj && obj.type === PSO.Molecule.Structure.type && obj.data === this.state.structure) {
                this.setState(this.getInitialState())
            }
        });
    }

    private getStructure(ref: string) {
        const state = this.plugin.state.dataState;
        const cell = state.select(ref)[0];
        if (!ref || !cell || !cell.obj) return Structure.Empty;
        return (cell.obj as PSO.Molecule.Structure).data;
    }

    private getSequenceWrapper() {
        return getSequenceWrapper(this.state, this.plugin.helpers.structureSelectionManager)
    }

    private getInitialState(): SequenceViewState {
        const structureRef = getStructureOptions(this.plugin.state.dataState)[0][0]
        const structure = this.getStructure(structureRef)
        let modelEntityId = getModelEntityOptions(structure)[0][0]
        let chainGroupId = getChainOptions(structure, modelEntityId)[0][0]
        let operatorKey = getOperatorOptions(structure, modelEntityId, chainGroupId)[0][0]
        if (this.state.structure && this.state.structure === structure) {
            modelEntityId = this.state.modelEntityId
            chainGroupId = this.state.chainGroupId
            operatorKey = this.state.operatorKey
        }
        return { structure, structureRef, modelEntityId, chainGroupId, operatorKey }
    }

    private get params() {
        const { structure, modelEntityId, chainGroupId } = this.state
        const structureOptions = getStructureOptions(this.plugin.state.dataState)
        const entityOptions = getModelEntityOptions(structure)
        const chainOptions = getChainOptions(structure, modelEntityId)
        const operatorOptions = getOperatorOptions(structure, modelEntityId, chainGroupId)
        return {
            structure: PD.Select(structureOptions[0][0], structureOptions, { shortLabel: true }),
            entity: PD.Select(entityOptions[0][0], entityOptions, { shortLabel: true }),
            chain: PD.Select(chainOptions[0][0], chainOptions, { shortLabel: true, twoColumns: true, label: 'Chain' }),
            operator: PD.Select(operatorOptions[0][0], operatorOptions, { shortLabel: true, twoColumns: true })
        }
    }

    private get values(): PD.Values<SequenceView['params']> {
        return {
            structure: this.state.structureRef,
            entity: this.state.modelEntityId,
            chain: this.state.chainGroupId,
            operator: this.state.operatorKey
        }
    }

    private setParamProps = (p: { param: PD.Base<any>, name: string, value: any }) => {
        const state = { ...this.state }
        switch (p.name) {
            case 'structure':
                state.structureRef = p.value
                state.structure = this.getStructure(p.value)
                state.modelEntityId = getModelEntityOptions(state.structure)[0][0]
                state.chainGroupId = getChainOptions(state.structure, state.modelEntityId)[0][0]
                state.operatorKey = getOperatorOptions(state.structure, state.modelEntityId, state.chainGroupId)[0][0]
                break
            case 'entity':
                state.modelEntityId = p.value
                state.chainGroupId = getChainOptions(state.structure, state.modelEntityId)[0][0]
                state.operatorKey = getOperatorOptions(state.structure, state.modelEntityId, state.chainGroupId)[0][0]
                break
            case 'chain':
                state.chainGroupId = p.value
                state.operatorKey = getOperatorOptions(state.structure, state.modelEntityId, state.chainGroupId)[0][0]
                break
            case 'operator':
                state.operatorKey = p.value
                break
        }
        this.setState(state)
    }

    render() {
        if (this.getStructure(this.state.structureRef) === Structure.Empty) return <div className='msp-sequence'>
            <div className='msp-sequence-wrapper'>No structure available</div>
        </div>;

        const sequenceWrapper = this.getSequenceWrapper()

        return <div className='msp-sequence'>
            <div className='msp-sequence-select'>
                <ParameterControls params={this.params} values={this.values} onChange={this.setParamProps} />
            </div>

            {typeof sequenceWrapper === 'string'
                ? <div className='msp-sequence-wrapper msp-sequence-wrapper-non-empty'>{sequenceWrapper}</div>
                : <Sequence sequenceWrapper={sequenceWrapper} />}
        </div>;
    }
}