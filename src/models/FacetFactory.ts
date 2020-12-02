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

    parse_facet_config(parent: DataModelList, typeName: string, allowedValues: string[], nullQuery: boolean, facet_config: any){
        return ({
            type: typeName,
            parent: parent,
            allowedValues: allowedValues,
            select: facet_config?.select,
            dataTable: nullQuery ? (facet_config?.null_table || facet_config?.table) : facet_config?.table,
            dataColumn: nullQuery ? (facet_config?.null_column || facet_config?.column) : facet_config?.column,
            whereClause: (nullQuery && facet_config?.null_count_column) ? facet_config?.null_where_clause : facet_config?.where_clause,
            countColumn: facet_config?.null_count_column,
            dataType: facet_config?.dataType || 'category',
            binSize: facet_config?.binSize,
            log: facet_config?.log,
            sourceExplanation: facet_config?.sourceExplanation
        } as FacetInfo);
    }
}
