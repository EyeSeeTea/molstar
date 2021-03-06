/**
 * Copyright (c) 2019 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Alexander Rose <alexander.rose@weirdbyte.de>
 */

import { Color } from '../../mol-util/color';
import { StructureElement, Link, Structure } from '../../mol-model/structure';
import { Location } from '../../mol-model/location';
import { ColorTheme, LocationColor } from '../color';
import { ParamDefinition as PD } from '../../mol-util/param-definition'
import { ThemeDataContext } from '../theme';
import { getPaletteParams, getPalette } from '../../mol-util/color/palette';
import { ScaleLegend, TableLegend } from '../../mol-util/legend';
import { ColorLists } from '../../mol-util/color/lists';

const DefaultList = 'dark-2'
const DefaultColor = Color(0xCCCCCC)
const Description = `Assigns a color based on the operator name of a transformed chain.`

export const OperatorNameColorThemeParams = {
    ...getPaletteParams({ type: 'set', setList: DefaultList }),
}
export type OperatorNameColorThemeParams = typeof OperatorNameColorThemeParams
export function getOperatorNameColorThemeParams(ctx: ThemeDataContext) {
    const params = PD.clone(OperatorNameColorThemeParams)
    if (ctx.structure) {
        if (getOperatorNameSerialMap(ctx.structure.root).size > ColorLists[DefaultList].list.length) {
            params.palette.defaultValue.name = 'scale'
            params.palette.defaultValue.params = {
                ...params.palette.defaultValue.params,
                list: 'red-yellow-blue'
            }
        }
    }
    return params
}

function getOperatorNameSerialMap(structure: Structure) {
    const map = new Map<string, number>()
    for (let i = 0, il = structure.units.length; i < il; ++i) {
        const name = structure.units[i].conformation.operator.name
        if (!map.has(name)) map.set(name, map.size)
    }
    return map
}

export function OperatorNameColorTheme(ctx: ThemeDataContext, props: PD.Values<OperatorNameColorThemeParams>): ColorTheme<OperatorNameColorThemeParams> {
    let color: LocationColor
    let legend: ScaleLegend | TableLegend | undefined

    if (ctx.structure) {
        const operatorNameSerialMap = getOperatorNameSerialMap(ctx.structure.root)

        const labelTable = Array.from(operatorNameSerialMap.keys())
        props.palette.params.valueLabel = (i: number) => labelTable[i]

        const palette = getPalette(operatorNameSerialMap.size, props)
        legend = palette.legend

        color = (location: Location): Color => {
            let serial: number | undefined = undefined
            if (StructureElement.Location.is(location)) {
                const name = location.unit.conformation.operator.name
                serial = operatorNameSerialMap.get(name)
            } else if (Link.isLocation(location)) {
                const name = location.aUnit.conformation.operator.name
                serial = operatorNameSerialMap.get(name)
            }
            return serial === undefined ? DefaultColor : palette.color(serial)
        }
    } else {
        color = () => DefaultColor
    }

    return {
        factory: OperatorNameColorTheme,
        granularity: 'instance',
        color,
        props,
        description: Description,
        legend
    }
}

export const OperatorNameColorThemeProvider: ColorTheme.Provider<OperatorNameColorThemeParams> = {
    label: 'Operator Name',
    factory: OperatorNameColorTheme,
    getParams: getOperatorNameColorThemeParams,
    defaultValues: PD.getDefaultValues(OperatorNameColorThemeParams),
    isApplicable: (ctx: ThemeDataContext) => !!ctx.structure
}