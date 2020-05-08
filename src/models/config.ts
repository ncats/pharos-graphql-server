import {DatabaseTable} from "./databaseConfig";

/**
 * Class for gathering tables and columns to use for standard queries
 */
export class Config {
    static GetDataFields(fieldKey: ConfigKeys, sortTable: string = "", sortColumn: string = ""): RequestedData[] {
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
        }
        if (sortColumn && !dataFields.find(field => {return field.data == sortColumn}) && !dataFields.find(field => {return field.alias == sortColumn})) {
            dataFields.push({table: sortTable, data: sortColumn, alias: sortColumn});
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
            existingTable.columns.push(new SqlColumns(reqData.data, reqData.alias));
            return;
        }
        this.addRequestedDataToNewTable(reqData);
    }

    addRequestedDataToNewTable(reqData: RequestedData) {
        const table = reqData.table;
        const data = reqData.data;
        const alias = reqData.alias;
        let links: string[] = [];
        const tableCount = this.tables.filter(t => {
            return t.tableName == table;
        }).length;

        if (DatabaseTable.sparseTables.includes(table)) {
            this.tables.push(SqlTable.getSparseTableData(table, data, alias, table + tableCount));
            return;
        }

        if (DatabaseTable.typeTables.includes(table)) {
            const typeColumn = DatabaseTable.typeTableColumns.get(table);
            if (!typeColumn) throw new Error(`bad table configuration - ${table} has no type column configuration`);
            const dataColumn = DatabaseTable.typeTableColumnMapping.get(table + "-" + data);
            this.tables.push(SqlTable.getTypeTableData(table, data, typeColumn, (dataColumn || data), alias, table + tableCount));
            return;
        }

        if (table != this.rootTable) {
            links = DatabaseTable.getRequiredLinks(table, this.rootTable) || [];
        }

        const newTable = new SqlTable(table, {}, links);
        newTable.columns.push(new SqlColumns(reqData.data, reqData.alias));
        this.tables.push(newTable);
    }

    getColumnList() {
        const columnList: any = {};
        for (let tableIndex = 0; tableIndex < this.tables.length; tableIndex++) {
            for (let columnIndex = 0; columnIndex < this.tables[tableIndex].columns.length; columnIndex++) {
                columnList[this.tables[tableIndex].columns[columnIndex].alias] = this.tables[tableIndex].alias + "." + this.tables[tableIndex].columns[columnIndex].column;
            }
        }
        return columnList;
    }

    getInnerJoinTables(): SqlTable[] {
        return this.tables.filter(table => {
            return table.allowUnmatchedRows == false;
        });
    }

    getLeftJoinTables(): SqlTable[] {
        return this.tables.filter(table => {
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
            if(tableList[i].tableName != this.rootTable) {
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

    constructor(tableName: string,
                {alias = "", allowUnmatchedRows = false, joinConstraint = ""} = {},
                linkingTables: string[] = []) {
        this.tableName = tableName;
        this.allowUnmatchedRows = allowUnmatchedRows;
        this.joinConstraint = joinConstraint;
        this.linkingTables = linkingTables;
        if (alias) {
            this._alias = alias;
        }
    }

    static getTypeTableData(tableName: string, typeName: string, typeColumn: string, dataColumn: string, columnAlias?: string, tableAlias?: string) {
        const typeTable = new SqlTable(tableName, {
            allowUnmatchedRows: true,
            joinConstraint: `${tableAlias || tableName}.${typeColumn} = '${typeName}'`,
            alias: tableAlias
        });
        typeTable.columns.push(new SqlColumns(dataColumn, columnAlias || dataColumn));
        return typeTable;
    }

    static getSparseTableData(tableName: string, dataColumn: string, columnAlias?: string, tableAlias?: string) {
        const sparseTable = new SqlTable(tableName, {allowUnmatchedRows: true, alias: tableAlias});
        sparseTable.columns.push(new SqlColumns(dataColumn, columnAlias || dataColumn));
        return sparseTable;
    }
}

export class SqlColumns {
    column: string;
    private _alias?: string = "";
    get alias(): string {
        if (this._alias) return this._alias;
        return this.column;
    }

    constructor(column: string, alias: string = "") {
        this.column = column;
        if (alias) {
            this._alias = alias;
        }
    }
}

export enum ConfigKeys {
    Target_List_Default,
    Target_List_PPI,
    Disease_List_Default
}