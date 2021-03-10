import {DiseaseList} from "./disease/diseaseList";
import {LigandList} from "./ligand/ligandList";
import {TargetList} from "./target/targetList";
import {DataModelList} from "./DataModelList";

export class DataModelListFactory {
    static getListObject(modelName: string, tcrd: any, json: any): DataModelList {
        if (modelName === "Diseases") {
            return new DiseaseList(tcrd, json);
        }
        if (modelName === "Ligands") {
            return new LigandList(tcrd, json);
        }
        if (modelName === "Targets") {
            return new TargetList(tcrd, json);
        }
        throw new Error('Unknown Data Model: Expecting Diseases, Ligands, or Targets');
    }
}
