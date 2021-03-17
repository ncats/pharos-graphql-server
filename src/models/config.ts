import {FieldInfo} from "./FieldInfo";
import {QueryDefinition} from "./queryDefinition";

/**
 * Class for gathering tables and columns to use for standard queries
 */
export class Config {
    /**
     * TODO : get rid of this when the normal list pages are using the pharos_config.fieldList
     * @param fieldKey
     * @param sortTable
     * @param sortColumn
     * @constructor
     */
    static GetDataFieldsFromKey(fieldKey: ConfigKeys, sortTable: string = "", sortColumn: string = ""): FieldInfo[] {
        const dataFields: FieldInfo[] = [];
        switch (fieldKey) {
            case ConfigKeys.Target_List_Similarity:
                break;
            case ConfigKeys.Disease_List_Default:
                dataFields.push({table:  "disease", column: "ncats_name", alias: "name"} as FieldInfo);
                break;
            case ConfigKeys.Ligand_List_Default:
                dataFields.push({table:  "ncats_ligands", column: "identifier", alias: "ligid"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "isDrug", alias: "isdrug"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "name"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "smiles"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "actCnt", alias: "actcnt"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "PubChem"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "ChEMBL"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "Guide to Pharmacology"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "DrugCentral"} as FieldInfo);
                dataFields.push({table:  "ncats_ligands", column: "description"} as FieldInfo);
                break;
        }
        if (sortTable && sortColumn && !dataFields.find(field => {
            return field.column === sortColumn && field.table === sortTable
        }) && !dataFields.find(field => {
            return field.alias  === sortColumn && field.table === sortTable
        })) {
            dataFields.push({table: sortTable, column: sortColumn, alias: sortColumn, group_method:"max"} as FieldInfo);
        } else if (sortColumn && !dataFields.find(field => {
            return field.column === sortColumn
        }) && !dataFields.find(field => {
            return field.alias === sortColumn
        })) {
            dataFields.push({table:  sortTable, column: sortColumn, alias: sortColumn, group_method:"max"} as FieldInfo);
        }
        return dataFields;
    }
}

export enum ConfigKeys {
    Target_List_Default,
    Target_List_PPI,
    Target_List_Disease,
    Target_List_Similarity,
    Disease_List_Default,
    Ligand_List_Default
}
