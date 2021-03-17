import {DataModelList} from "./DataModelList";
import {FieldInfo} from "./FieldInfo";

export abstract class FacetFactory {
    abstract GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], extra?: any): FieldInfo;

    getFacetsFromList(parent: DataModelList, list: string[], extra?: any): FieldInfo[] {
        let facetList: FieldInfo[] = [];
        if (list && list.length > 0) {
            for (let i = 0; i < list.length; i++) {
                let newFacet = this.GetFacet(parent, list[i], [], extra);
                if (newFacet.table != "") {
                    facetList.push(newFacet);
                }
            }
        }
        return facetList;
    }

    unknownFacet(): FieldInfo {
        return new FieldInfo({} as FieldInfo);
    }

}
