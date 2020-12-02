import {TargetFacetType} from "./targetFacetType";
import {DataModelList} from "../DataModelList";
import {FacetDataType, FacetInfo} from "../FacetInfo";
import {FacetFactory} from "../FacetFactory";
import {DiseaseList} from "../disease/diseaseList";
// @ts-ignore
import * as CONSTANTS from "../../constants";

export class TargetFacetFactory extends FacetFactory{

    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], nullQuery: boolean = false): FacetInfo {
        const facet_config = parent.databaseConfig.facetMap.get(`${parent.rootTable}-${typeName}`);
        const partialReturn = this.parse_facet_config(parent, typeName, allowedValues, nullQuery, facet_config);

        const type: TargetFacetType = (<any>TargetFacetType)[typeName];
        switch (type) {
            case TargetFacetType["PPI Data Source"]:
                if(!parent.associatedTarget) { return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: `other_id = (select id from protein where match(uniprot,sym,stringid) against('${parent.associatedTarget}' in boolean mode))`,
                    valuesDelimited: true
                } as FacetInfo);
            case TargetFacetType["Disease Data Source"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`,
                } as FacetInfo);
            case TargetFacetType["Linked Disease"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`,
                } as FacetInfo);
            case TargetFacetType["StringDB Interaction Score"]:
                if(!parent.associatedTarget) { return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: `other_id = (select id from protein where match(uniprot,sym,stringid) against('${parent.associatedTarget}' in boolean mode))`
                } as FacetInfo);
            case TargetFacetType["BioPlex Interaction Probability"]:
                if(!parent.associatedTarget) { return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: `other_id = (select id from protein where match(uniprot,sym,stringid) against('${parent.associatedTarget}' in boolean mode))`
                } as FacetInfo);
            case TargetFacetType["JensenLab TextMining zscore"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`
                } as FacetInfo);
            case TargetFacetType["JensenLab Confidence"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`
                } as FacetInfo);
            case TargetFacetType["Expression Atlas Log2 Fold Change"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`
                } as FacetInfo);
            case TargetFacetType["DisGeNET Score"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`
                } as FacetInfo);
        }
        return new FacetInfo(partialReturn);
    }
}
