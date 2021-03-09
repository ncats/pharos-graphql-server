import {DatabaseTable} from "./databaseTable";
import {DatabaseConfig} from "./databaseConfig";

/**
 * Class for gathering tables and columns to use for standard queries
 */
export class Config {
    static GetDataFields(rootTable: string, fields: string[], dbConfig: DatabaseConfig): RequestedData[] {
        const dataFields: RequestedData[] = [];

        // TODO : get primary key better
        dataFields.push({table: "protein", data: "id", alias: 'id'});

        fields.forEach(field => {
            const facetInfo = dbConfig.getFacetConfig(rootTable, field);
            dataFields.push({table: facetInfo.dataTable, data: facetInfo.dataColumn, alias: field, where_clause: facetInfo.whereClause, group_method: facetInfo.group_method});
        });
        return dataFields;
    }

    /**
     * TODO : get rid of this when the normal list pages are using the pharos_config.fieldList
     * @param fieldKey
     * @param sortTable
     * @param sortColumn
     * @constructor
     */
    static GetDataFieldsFromKey(fieldKey: ConfigKeys, sortTable: string = "", sortColumn: string = ""): RequestedData[] {
        const dataFields: RequestedData[] = [];
        switch (fieldKey) {
            case ConfigKeys.Target_List_Default:
                dataFields.push({table: "target", data: "id", alias: "tcrdid"});
                dataFields.push({table: "target", data: "tdl"});
                dataFields.push({table: "target", data: "fam"});

                dataFields.push({table: "protein", data: "description", alias: "name"});
                dataFields.push({table: "protein", data: "uniprot"});
                dataFields.push({table: "protein", data: "sym"});
                dataFields.push({table: "protein", data: "seq"});

                dataFields.push({table: "tinx_novelty", data: "score", alias: "novelty"});
                dataFields.push({table: "tdl_info", data: "NCBI Gene Summary", alias: "description"});
                break;
            case ConfigKeys.Target_List_PPI:
                dataFields.push({table: "target", data: "id", alias: "tcrdid"});
                dataFields.push({table: "target", data: "tdl"});
                dataFields.push({table: "target", data: "fam"});

                dataFields.push({table: "protein", data: "description", alias: "name"});
                dataFields.push({table: "protein", data: "sym"});
                dataFields.push({table: "protein", data: "uniprot"});
                dataFields.push({table: "protein", data: "seq"});

                dataFields.push({table: "tinx_novelty", data: "score", alias: "novelty"});

                dataFields.push({table: "ncats_ppi", data: "ppitypes"});
                dataFields.push({table: "ncats_ppi", data: "interaction_type"});
                dataFields.push({table: "ncats_ppi", data: "evidence"});
                dataFields.push({table: "ncats_ppi", data: "score"});
                dataFields.push({table: "ncats_ppi", data: "p_ni"});
                dataFields.push({table: "ncats_ppi", data: "p_int"});
                dataFields.push({table: "ncats_ppi", data: "p_wrong"});
                break;
            case ConfigKeys.Target_List_Disease:
                dataFields.push({table: "target", data: "id", alias: "tcrdid"});
                dataFields.push({table: "target", data: "tdl"});
                dataFields.push({table: "target", data: "fam"});

                dataFields.push({table: "protein", data: "description", alias: "name"});
                dataFields.push({table: "protein", data: "sym"});
                dataFields.push({table: "protein", data: "uniprot"});
                dataFields.push({table: "protein", data: "seq"});

                dataFields.push({table: "tinx_novelty", data: "score", alias: "novelty"});

                dataFields.push({table: "disease", data: `dtype`, group_method: `count`});
                break;
            case ConfigKeys.Target_List_Similarity:
                dataFields.push({table: "target", data: "id", alias: "tcrdid"});
                dataFields.push({table: "target", data: "tdl"});
                dataFields.push({table: "target", data: "fam"});

                dataFields.push({table: "protein", data: "description", alias: "name"});
                dataFields.push({table: "protein", data: "sym"});
                dataFields.push({table: "protein", data: "uniprot"});
                dataFields.push({table: "protein", data: "seq"});

                dataFields.push({table: "tinx_novelty", data: "score", alias: "novelty"});

                dataFields.push({subQuery: true, table: "similarityQuery", data:"jaccard"});
                dataFields.push({subQuery: true, table: "similarityQuery", data:"overlap"});
                dataFields.push({subQuery: true, table: "similarityQuery", data:"baseSize"});
                dataFields.push({subQuery: true, table: "similarityQuery", data:"testSize"});
                dataFields.push({subQuery: true, table: "similarityQuery", data:"commonOptions"});
                break;
            case ConfigKeys.Disease_List_Default:
                dataFields.push({table: "disease", data: "ncats_name", alias: "name"});
                break;
            case ConfigKeys.Ligand_List_Default:
                dataFields.push({table: "ncats_ligands", data: "identifier", alias: "ligid"});
                dataFields.push({table: "ncats_ligands", data: "isDrug", alias: "isdrug"});
                dataFields.push({table: "ncats_ligands", data: "name"});
                dataFields.push({table: "ncats_ligands", data: "smiles"});
                dataFields.push({table: "ncats_ligands", data: "actCnt", alias: "actcnt"});
                dataFields.push({table: "ncats_ligands", data: "PubChem"});
                dataFields.push({table: "ncats_ligands", data: "ChEMBL"});
                dataFields.push({table: "ncats_ligands", data: "Guide to Pharmacology"});
                dataFields.push({table: "ncats_ligands", data: "DrugCentral"});
                dataFields.push({table: "ncats_ligands", data: "description"});
                break;
        }
        if (sortTable && sortColumn && !dataFields.find(field => {
            return field.data === sortColumn && field.table === sortTable
        }) && !dataFields.find(field => {
            return field.alias === sortColumn && field.table === sortTable
        })) {
            dataFields.push({table: sortTable, data: sortColumn, alias: sortColumn, group_method:"max"});
        } else if (sortColumn && !dataFields.find(field => {
            return field.data === sortColumn
        }) && !dataFields.find(field => {
            return field.alias === sortColumn
        })) {
            dataFields.push({table: sortTable, data: sortColumn, alias: sortColumn, group_method:"max"});
        }
        return dataFields;
    }
}

/**
 * Class to hold details for what columns the user wants to retrieve
 */
export class RequestedData {
    table: string = "";
    data: string = "";
    alias?: string = "";
    group_method?: string = "";
    where_clause?: string = "";
    subQuery?: boolean = false;
}

/**
 * Class to hold all the details required to generate a query given a required set of data
 */
export class QueryDefinition {
    tables: SqlTable[] = [];
    rootTable: string;

    constructor(rootTable: string) {
        this.rootTable = rootTable;
    }

    static GenerateQueryDefinition(rootTable: string, dataList: RequestedData[]): QueryDefinition {
        let qd = new QueryDefinition(rootTable);
        for (let i = 0; i < dataList.length; i++) {
            qd.addRequestedData(dataList[i]);
        }
        return qd;
    }

    addRequestedData(reqData: RequestedData) {
        if (DatabaseTable.leftJoinTables.includes(reqData.table)) {
            this.addRequestedDataToNewTable(reqData);
            return;
        }
        const existingTable = this.tables.find(table => {
            return table.tableName == reqData.table;
        });
        if (existingTable) {
            existingTable.columns.push(new SqlColumns(reqData.data, reqData.alias, reqData.group_method));
            return;
        }
        this.addRequestedDataToNewTable(reqData);
    }

    addRequestedDataToNewTable(reqData: RequestedData) {
        let links: string[] = [];
        const tableCount = this.tables.filter(t => {
            return t.tableName == reqData.table;
        }).length;

        if (DatabaseTable.sparseTables.includes(reqData.table)) {
            this.tables.push(SqlTable.getSparseTableData(reqData.table, reqData.data, reqData.alias, reqData.table + tableCount, reqData.group_method, reqData.where_clause));
            return;
        }

        if (DatabaseTable.typeTables.includes(reqData.table)) {
            const typeColumn = DatabaseTable.typeTableColumns.get(reqData.table);
            if (!typeColumn) throw new Error(`bad table configuration - ${reqData.table} has no type column configuration`);
            const dataColumn = DatabaseTable.typeTableColumnMapping.get(reqData.table + "-" + reqData.data);
            this.tables.push(
                SqlTable.getTypeTableData(
                    reqData.table,
                    reqData.data,
                    typeColumn,
                    (dataColumn || reqData.data),
                    reqData.alias,
                    reqData.table + tableCount)
                );
            return;
        }

        if (reqData.table != this.rootTable) {
            links = DatabaseTable.getRequiredLinks(reqData.table, this.rootTable) || [];
        }

        const newTable = new SqlTable(reqData.table, {}, links, reqData.subQuery);
        newTable.columns.push(new SqlColumns(reqData.data, reqData.alias, reqData.group_method));
        this.tables.push(newTable);
    }

    getColumnObj(table: string, column: string) {
        let matchingTables = this.tables.filter(t => {return t.tableName == table;});
        for(let i = 0 ; i < matchingTables.length ; i++){
            let matchingColumns = matchingTables[i].columns.filter(c => {return c.column === column});
            if(matchingColumns.length > 0){
                return matchingColumns[0];
            }
        }
        return null;
    }

    getColumnList(db: any) {
        const columnList: any = {};
        for (let tableIndex = 0; tableIndex < this.tables.length; tableIndex++) {
            for (let columnIndex = 0; columnIndex < this.tables[tableIndex].columns.length; columnIndex++) {
                if (this.tables[tableIndex].columns[columnIndex].group_method) {
                    columnList[this.tables[tableIndex].columns[columnIndex].alias] =
                        db.raw(this.tables[tableIndex].columns[columnIndex].group_method
                            + '(distinct `' + this.tables[tableIndex].alias + "`.`" + this.tables[tableIndex].columns[columnIndex].column + '`)');
                } else {
                    columnList[this.tables[tableIndex].columns[columnIndex].alias] =
                        db.raw("`" + this.tables[tableIndex].alias + "`.`" + this.tables[tableIndex].columns[columnIndex].column + "`");
                }
            }
        }
        return columnList;
    }

    getInnerJoinTables(): SqlTable[] {
        return this.tables.filter(table => {
            if (table.subQuery) return false;
            return table.allowUnmatchedRows == false;
        });
    }

    getLeftJoinTables(): SqlTable[] {
        return this.tables.filter(table => {
            if (this.rootTable === table.tableName) return false;
            if (table.subQuery) return false;
            return table.allowUnmatchedRows == true;
        });
    }

    getRootTable(): SqlTable | undefined {
        return this.tables.find(table => {
            return table.tableName == this.rootTable
        });
    }

    getTablesAsObjectArray(tableList: SqlTable[]): any {
        let obj: any = {};
        for (let i = 0; i < tableList.length; i++) {
            if (tableList[i].tableName != this.rootTable) {
                obj[tableList[i].alias] = tableList[i].tableName;
                for (let j = 0; j < tableList[i].linkingTables.length; j++) {
                    obj[tableList[i].linkingTables[j]] = tableList[i].linkingTables[j];
                }
            }
        }
        obj[this.rootTable] = this.rootTable;
        return obj;
    }
}

export class SqlTable {
    tableName: string;
    private _alias?: string;
    get alias(): string {
        if (this._alias) return this._alias;
        return this.tableName;
    }

    allowUnmatchedRows?: boolean;
    joinConstraint: string;
    columns: SqlColumns[] = [];
    linkingTables: string[] = [];
    subQuery: boolean = false;

    constructor(tableName: string,
                {alias = "", allowUnmatchedRows = false, joinConstraint = ""} = {},
                linkingTables: string[] = [], subQuery: boolean = false) {
        this.tableName = tableName;
        this.allowUnmatchedRows = allowUnmatchedRows;
        this.joinConstraint = joinConstraint;
        this.linkingTables = linkingTables;
        this.subQuery = subQuery;
        if (alias) {
            this._alias = alias;
        }
    }

    static getTypeTableData(tableName: string, typeName: string, typeColumn: string, dataColumn: string, columnAlias?: string, tableAlias?: string, group_method?: string, where_clause?: string) {
        const typeTable = new SqlTable(tableName, {
            allowUnmatchedRows: true,
            joinConstraint: `${tableAlias || tableName}.${typeColumn} = '${typeName}'`,
            alias: tableAlias
        });
        typeTable.columns.push(new SqlColumns(dataColumn, columnAlias || dataColumn, group_method, where_clause));
        return typeTable;
    }

    static getSparseTableData(tableName: string, dataColumn: string, columnAlias?: string, tableAlias?: string, group_method?: string, where_clause?: string) {
        const sparseTable = new SqlTable(tableName, {allowUnmatchedRows: true, alias: tableAlias});
        if(where_clause && tableAlias) {
            where_clause = where_clause.replace(tableName, tableAlias);
        }
        sparseTable.columns.push(new SqlColumns(dataColumn, columnAlias || dataColumn, group_method, where_clause));
        return sparseTable;
    }
}

export class SqlColumns {
    column: string;
    private _alias?: string = "";
    group_method?: string = "";
    where_clause?: string = "";

    get alias(): string {
        if (this._alias) return this._alias;
        return this.column;
    }

    constructor(column: string, alias: string = "", group_method: string = "", where_clause: string = "") {
        this.column = column;
        this.group_method = group_method;
        this.where_clause = where_clause;
        if (alias) {
            this._alias = alias;
        }
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
