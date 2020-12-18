import {DataModelList} from "./DataModelList";
import {FacetInfo} from "./FacetInfo";

export abstract class FacetFactory {
    abstract GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FacetInfo;

    getFacetsFromList(parent: DataModelList, list: string[], extra?: any): FacetInfo[] {
        let facetList: FacetInfo[] = [];
        if (list && list.length > 0) {
            for (let i = 0; i < list.length; i++) {
                let newFacet = this.GetFacet(parent, list[i], [], extra);
                if (newFacet.dataTable != "") {
                    facetList.push(newFacet);
                }
            }
        }
        return facetList;
    }

    unknownFacet(): FacetInfo {
        return new FacetInfo({} as FacetInfo);
    }

    parse_facet_config(parent: DataModelList, typeName: string, allowedValues: string[], nullQuery: boolean, facet_config: any) {
        const hasNullQueryFields = () => {
            return !!facet_config?.null_count_column;
        };

        const returnObj: FacetInfo = {} as FacetInfo;
        returnObj.type = typeName;
        returnObj.parent = parent;
        returnObj.allowedValues = allowedValues;
        returnObj.select = facet_config?.select;
        returnObj.dataType = facet_config?.dataType || 'category';
        returnObj.binSize = facet_config?.binSize;
        returnObj.log = facet_config?.log;
        returnObj.sourceExplanation = facet_config?.sourceExplanation;
        if (nullQuery && hasNullQueryFields()) {
            returnObj.dataTable = facet_config?.null_table;
            returnObj.dataColumn = facet_config?.null_column;
            returnObj.whereClause = facet_config?.null_where_clause;
            returnObj.countColumn = facet_config?.null_count_column;
        } else {
            returnObj.dataTable = facet_config?.table;
            returnObj.dataColumn = facet_config?.column;
            returnObj.whereClause = facet_config?.where_clause;
        }
        return returnObj;
    }
}
