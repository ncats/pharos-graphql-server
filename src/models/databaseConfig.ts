import {DatabaseTable, TableLink, TableLinkInfo} from "./databaseTable";
import {FacetInfo} from "./FacetInfo";

/**
 * Class to query the database to see what tables and foreign keys are there, to automatically generate the query for the requested data
 */
export class DatabaseConfig {
    tables: DatabaseTable[] = [];
    modelList: Map<string, {name: string, rootTable: string}> = new Map<string, {name: string, rootTable: string}>();
    facetMap: Map<string, any> = new Map<string, any>();
    fieldLists: Map<string, any[]> = new Map<string, any[]>();
    database: any;
    dbName: string;
    configDB: string;

    private _fieldTable: { field: string } = {field: ''};
    get fieldTable(): { field: string } {
        return {field: this.configDB + '.field'};
    }

    private _fieldListTable: { fieldList: string } = {fieldList: ''};
    get fieldListTable(): { fieldList: string } {
        return {fieldList: this.configDB + '.fieldList'};
    }

    private _modelTable: { model: string } = {model: ''};
    get modelTable(): { model: string } {
        return {model: this.configDB + '.model'};
    };

    constructor(database: any, dbName: string, configDB: string) {
        this.database = database;
        this.dbName = dbName;
        this.configDB = configDB;

        this.parseTables();
        this.parseFacets();
        this.parseLists();
    }

    parseTables() {
        let query = this.database.raw('show tables from ' + this.dbName);
        query.then((rows: any) => {
            for (let tableKey in rows[0]) {
                this.tables.push(new DatabaseTable(this.database, this.dbName, rows[0][tableKey]["Tables_in_" + this.dbName]));
            }
        });
    }

    parseFacets() {
        let facetQuery = this.database({...this.fieldTable, ...this.modelTable})
            .select(
                {
                    ...this.fieldColumns,
                    ...this.modelColumns
                }).whereRaw(this.linkFieldToModel);
        facetQuery.then((rows: any[]) => {
            for (let row of rows) {
                this.facetMap.set(`${row.rootTable}-${row.type}`, row);
            }
        });
    }

    fieldListColumns = {
        listName: `fieldList.name`,
        order: 'fieldList.order'
    };
    fieldColumns = {
        model_id: `field.model_id`,
        type: `field.type`,
        dataTable: `field.table`,
        dataColumn: `field.column`,
        select: `field.select`,
        whereClause: `field.where_clause`,
        null_table: `field.null_table`,
        null_column: `field.null_column`,
        null_count_column: `field.null_count_column`,
        null_where_clause: `field.null_where_clause`,
        dataType: `field.dataType`,
        binSize: `field.binSize`,
        log: `field.log`,
        sourceExplanation: `field.description`,
        isGoodForFacet: `field.isGoodForFacet`
    };
    modelColumns = {
        modelName: 'model.name',
        rootTable: 'model.table',
        rootColumn: 'model.column'
    };
    linkFieldToModel = 'field.model_id = model.id';
    linkFieldListToField = 'fieldList.field_id = field.id';

    parseLists() {
        const listQuery = this.database({
            ...this.fieldTable,
            ...this.fieldListTable,
            ...this.modelTable
        })
            .select({
                ...this.fieldListColumns,
                ...this.fieldColumns,
                ...this.modelColumns
            })
            .whereRaw(this.linkFieldListToField)
            .whereRaw(this.linkFieldToModel);
        listQuery.then((rows: any[]) => {
            rows.forEach(row => {
                if (this.fieldLists.has(row.listName)) {
                    const list = this.fieldLists.get(row.listName);
                    list?.push(row);
                } else {
                    this.fieldLists.set(row.listName, [row]);
                }
            });
        });
        const allFieldsQuery = this.database({...this.fieldTable, ...this.modelTable})
            .select({...this.fieldColumns, ...this.modelColumns})
            .whereRaw(this.linkFieldToModel);
        // console.log(allFieldsQuery.toString());
        allFieldsQuery.then((rows: any[]) => {
            rows.forEach(row => {
                const keyName = `${row.modelName} Facets - All`;
                if(row.isGoodForFacet) {
                    if (this.fieldLists.has(keyName)) {
                        const list = this.fieldLists.get(keyName);
                        list?.push(row);
                    } else {
                        this.fieldLists.set(keyName, [row]);
                    }
                    if (!this.modelList.has(row.rootTable)) {
                        this.modelList.set(row.rootTable, {rootTable: row.rootTable, name: row.modelName});
                    }
                }
            });
        });
    }

    getFacetConfig(rootTable: string, facetType: string) {
        return this.facetMap.get(`${rootTable}-${facetType}`);
    }

    getPrimaryKey(table: string): string {
        const t = this.tables.find(t => {
            return t.tableName == table;
        });
        return t?.primaryKey || 'id';
    }

    getLinkInformation(fromTable: string, toTable: string): TableLinkInfo | null {
        let linkInfo = this._getLinkInformation(fromTable, toTable);
        if (!linkInfo) {
            linkInfo = this._getLinkInformation(toTable, fromTable, true);
        }
        return linkInfo;
    }

    private _getLinkInformation(fromTable: string, toTable: string, reverse: boolean = false): TableLinkInfo | null {
        const from: DatabaseTable | undefined = this.tables.find((table: DatabaseTable) => {
            return table.tableName == fromTable;
        });
        if (from == undefined) {
            return null;
        }
        let toLinks: TableLink[] = from.links.filter(table => {
            return table.otherTable == toTable;
        });
        if (toLinks.length > 1) {
            toLinks = toLinks.filter(link => {
                return link.column == DatabaseTable.preferredLink.get(`${fromTable}-${toTable}`)
            });
        }
        const toLink = toLinks[0];
        if (toLink == undefined) {
            return null;
        }
        if (reverse) {
            return new TableLinkInfo(toLink.otherColumn, toLink.column)
        }
        return new TableLinkInfo(toLink.column, toLink.otherColumn);
    }

    getJoinTables(rootTable: string, dataTable: string): string[]{
        let joinTables: string[] = [];

        if (dataTable != rootTable) {
            const links = DatabaseTable.getRequiredLinks(dataTable, rootTable) || [];
            joinTables.push(...links);
            joinTables.push(rootTable);
        }
        return  joinTables;
    }

    getBaseSetQuery(rootTable: string, facet: FacetInfo, columns?: any){
        const joinTables = this.getJoinTables(rootTable, facet.dataTable);

        const query = this.database(facet.dataTable);
        if(!columns) {
            query.distinct({value: this.database.raw(facet.select)});
        }
        else{
            query.select(columns);
        }

        let leftTable = facet.dataTable;
        joinTables.forEach(rightTable => {
            const linkInfo = this.getLinkInformation(leftTable, rightTable);
            query.join(rightTable, `${leftTable}.${linkInfo?.fromCol}`, '=', `${rightTable}.${linkInfo?.toCol}`);
            leftTable = rightTable;
        });

        if (facet.whereClause.length > 0) {
            query.whereRaw(facet.whereClause);
        }
        return query;
    }
}
