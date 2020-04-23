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
}