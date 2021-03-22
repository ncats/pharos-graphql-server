import {DataModelList} from "./DataModelList";
import {FieldInfo} from "./FieldInfo";

export class FacetFactory {
    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], nullQuery: boolean = false): FieldInfo {
        const fieldInfo = parent.databaseConfig.getOneField(parent.modelInfo.name, 'facet', parent.getAssociatedModel(), '', typeName);
        if(!fieldInfo){
            return this.unknownFacet();
        }
        fieldInfo.allowedValues = allowedValues;
        fieldInfo.parent = parent;
        if (typeName === "PPI Data Source") { // :(
            fieldInfo.valuesDelimited = true;
        }
        return fieldInfo;
    }

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
