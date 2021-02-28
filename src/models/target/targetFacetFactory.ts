import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";
import {FacetFactory} from "../FacetFactory";
import {DiseaseList} from "../disease/diseaseList";

export class TargetFacetFactory extends FacetFactory{

    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], nullQuery: boolean = false): FacetInfo {
        const facet_config = parent.databaseConfig.getFacetConfig(parent.rootTable, typeName);
        const partialReturn = this.parse_facet_config(parent, typeName, allowedValues, nullQuery, facet_config);

        switch (typeName) {
            case "PPI Data Source":
                if(!parent.associatedTarget) { return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: `other_id = (select id from protein where match(uniprot,sym,stringid) against('${parent.associatedTarget}' in boolean mode))`,
                    valuesDelimited: true
                } as FacetInfo);
            case "Disease Data Source":
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`,
                } as FacetInfo);
            case "Linked Disease":
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`,
                } as FacetInfo);
            case "StringDB Interaction Score":
                if(!parent.associatedTarget) { return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: `other_id = (select id from protein where match(uniprot,sym,stringid) against('${parent.associatedTarget}' in boolean mode))`
                } as FacetInfo);
            case "BioPlex Interaction Probability":
                if(!parent.associatedTarget) { return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedTarget,
                    whereClause: `other_id = (select id from protein where match(uniprot,sym,stringid) against('${parent.associatedTarget}' in boolean mode))`
                } as FacetInfo);
            case "JensenLab TextMining zscore":
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`
                } as FacetInfo);
            case "JensenLab Confidence":
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`
                } as FacetInfo);
            case "Expression Atlas Log2 Fold Change":
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    typeModifier: parent.associatedDisease,
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`
                } as FacetInfo);
            case "DisGeNET Score":
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
