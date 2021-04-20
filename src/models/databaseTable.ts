import {DataModelList} from "./DataModelList";

export class DatabaseTable {
    tableName: string;
    primaryKey?: string;
    links: TableLink[] = [];
    dataTypes: Map<string, string> = new Map<string, string>();
    loadPromise: Promise<any>;

    constructor(database: any, dbname: string, name: string) {
        this.tableName = name;
        this.loadPromise = Promise.all([
            this.getKeys(database, dbname),
            this.getColumnInfo(database, dbname)
        ]);
    }

    getColumnInfo(database: any, dbname: string) {
        let query = database('INFORMATION_SCHEMA.COLUMNS')
            .select(['column_name', 'data_type'])
            .where('table_schema', dbname)
            .andWhere('table_name', this.tableName);
        return query.then((rows: any) => {
            for (let rowKey in rows) {
                this.dataTypes.set(rows[rowKey]['column_name'], rows[rowKey]['data_type']);
            }
        });
    }

    columnIsNumeric(column: string) {
        let dataType = this.dataTypes.get(column)?.toLowerCase();
        if (dataType) {
            return ['bigint', 'int', 'tinyint', 'decimal', 'double', 'float'].includes(dataType);
        }
        return null
    }

    getKeys(database: any, dbname: string) {
        let query = database('information_schema.key_column_usage')
            .select(['constraint_name', 'column_name', 'referenced_table_name', 'referenced_column_name'])
            .where('table_schema', dbname)
            .andWhere('table_name', this.tableName);
        return query.then((rows: any) => {
            for (let rowKey in rows) {
                if (rows[rowKey]['constraint_name'] == 'PRIMARY') {
                    this.primaryKey = rows[rowKey]['column_name']
                } else {
                    this.links.push(new TableLink(
                        rows[rowKey]['column_name'],
                        rows[rowKey]['referenced_table_name'],
                        rows[rowKey]['referenced_column_name']));
                }
            }
        });
    }

    static preferredLink: Map<string, string> = new Map(
        [
            ["ncats_ppi-protein", "protein_id"]
        ]
    );

    static requiredLinks: Map<string, string[]> = new Map(
        [
            ["ncats_disease-ncats_ligands", ["ncats_ligand_activity", "target", "t2tc", "protein", "disease", "ncats_d2da"]],
            ["ncats_disease-ncats_ligand_activity", ["target", "t2tc", "protein", "disease", "ncats_d2da"]],
            ["ncats_disease-disease", ["ncats_d2da"]],
            ["ncats_disease-target", ["t2tc", "protein", "disease", "ncats_d2da"]],
            ["ncats_disease-protein", ["disease", "ncats_d2da"]],
            ["disease-target", ["t2tc", "protein"]],
            ["protein-viral_protein", ["viral_ppi"]],
            ["protein-tinx_disease", ["tinx_importance"]],
            ["protein-pubmed", ["protein2pubmed"]],
            ["protein-virus", ["viral_protein", "viral_ppi"]],
            ["protein-dto", ["p2dto"]],
            ["protein-panther_class", ["p2pc"]],
            ["protein-target", ["t2tc"]],
            ["protein-ncats_idg_list_type", ["ncats_idg_list"]],
            ["protein-ncats_ligands", ["ncats_ligand_activity", "target", "t2tc"]],
            ["protein-ncats_ligand_activity", ["target", "t2tc"]],
            ["protein-drgc_resource", ["target", "t2tc"]]
        ]);

    static getRequiredLinks(table1: string, table2: string): string[] | undefined {
        let reqTables = DatabaseTable.requiredLinks.get(table1 + "-" + table2);
        if (reqTables) return reqTables;
        return DatabaseTable.requiredLinks.get(table2 + "-" + table1)?.slice().reverse();
    }
}

export class TableLink {
    column: string;
    otherTable: string;
    otherColumn: string;

    constructor(column: string, otherTable: string, otherColumn: string) {
        this.column = column;
        this.otherTable = otherTable;
        this.otherColumn = otherColumn;
    }
}

export class TableLinkInfo {
    fromCol: string;
    toCol: string;

    constructor(fromColumn: string, toColumn: string) {
        this.fromCol = fromColumn;
        this.toCol = toColumn;
    }
}
