/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { ParamDefinition as PD } from '../../../mol-util/param-definition';
import { UnitsMeshParams, UnitsVisual, UnitsMeshVisual } from '../units-visual';
import { MolecularSurfaceCalculationParams } from '../../../mol-math/geometry/molecular-surface';
import { VisualContext } from '../../visual';
import { Unit, Structure } from '../../../mol-model/structure';
import { Theme } from '../../../mol-theme/theme';
import { Mesh } from '../../../mol-geo/geometry/mesh/mesh';
import { computeUnitMolecularSurface, MolecularSurfaceProps } from './util/molecular-surface';
import { computeMarchingCubesMesh } from '../../../mol-geo/util/marching-cubes/algorithm';
import { ElementIterator, getElementLoci, eachElement } from './util/element';
import { VisualUpdateState } from '../../util';

export const MolecularSurfaceMeshParams = {
    ...UnitsMeshParams,
    ...MolecularSurfaceCalculationParams,
    ignoreHydrogens: PD.Boolean(false),
}
export type MolecularSurfaceMeshParams = typeof MolecularSurfaceMeshParams

//

async function createMolecularSurfaceMesh(ctx: VisualContext, unit: Unit, structure: Structure, theme: Theme, props: MolecularSurfaceProps, mesh?: Mesh): Promise<Mesh> {

    const { transform, field, idField } = await computeUnitMolecularSurface(unit, props).runInContext(ctx.runtime)
    const params = {
        isoLevel: props.probeRadius,
        scalarField: field,
        idField
    }
    const surface = await computeMarchingCubesMesh(params, mesh).runAsChild(ctx.runtime)

    Mesh.transformImmediate(surface, transform)
    if (ctx.webgl && !ctx.webgl.isWebGL2) Mesh.uniformTriangleGroup(surface)

    return surface
}

export function MolecularSurfaceMeshVisual(materialId: number): UnitsVisual<MolecularSurfaceMeshParams> {
    return UnitsMeshVisual<MolecularSurfaceMeshParams>({
        defaultProps: PD.getDefaultValues(MolecularSurfaceMeshParams),
        createGeometry: createMolecularSurfaceMesh,
        createLocationIterator: ElementIterator.fromGroup,
        getLoci: getElementLoci,
        eachLocation: eachElement,
        setUpdateState: (state: VisualUpdateState, newProps: PD.Values<MolecularSurfaceMeshParams>, currentProps: PD.Values<MolecularSurfaceMeshParams>) => {
            if (newProps.resolution !== currentProps.resolution) state.createGeometry = true
            if (newProps.probeRadius !== currentProps.probeRadius) state.createGeometry = true
            if (newProps.probePositions !== currentProps.probePositions) state.createGeometry = true
            if (newProps.ignoreHydrogens !== currentProps.ignoreHydrogens) state.createGeometry = true
        }
    }, materialId)
}