import {DatabaseTable, TableLink, TableLinkInfo} from "./databaseTable";
import {FieldInfo} from "./FieldInfo";
import {ListManager} from "./listManager";

export class ModelInfo {
    name: string;
    table: string;
    column: string;
    constructor(obj: {name: string, table: string, column: string}) {
        this.name = obj.name;
        this.table = obj.table;
        this.column = obj.column;
    }
}


export class FieldList {
    model: string;
    context: string;
    associatedModel: string = '';
    listName: string = '';

    constructor(model: string, context: string, associatedModel: string, listName: string) {
        this.model = model;
        this.context = context || '';
        this.associatedModel = associatedModel || '';
        this.listName = listName || '';
    }

    static parseJson(obj: any): FieldList {
        return new FieldList(obj.model, obj.context, obj.associatedModel, obj.listName);
    }

    static parseJsonContextFree(obj: any): FieldList {
        if(obj.context === 'facet'){
            return new FieldList(obj.model, obj.context, obj.associatedModel, '');
        }
        return new FieldList(obj.model, '', obj.associatedModel, '');
    }

    get listKey(): string {
        return `${this.model}-${this.context}-${this.associatedModel}`.toLowerCase() + `-${this.listName}`;
    }
}

/**
 * Class to query the database to see what tables and foreign keys are there, to automatically generate the query for the requested data
 */
export class DatabaseConfig {
    tables: DatabaseTable[] = [];
    listManager: ListManager = new ListManager();

    probMap: Map<string, {count: number, p: number}> = new Map<string, {count: number, p: number}>();
    probKey(model: string, filter: string, value: string) {
        return `${model}-${filter}-${value}`.replace(/[^a-zA-Z0-9\-\s\.]/g, " ");
    }

    findValueProbability(model: string, filter: string, value: string) {
        return this.probMap.get(this.probKey(model, filter, value));
    }

    populateFieldLists() {
        const query = this.database({...this.modelTable, ...this.fieldListTable, ...this.fieldTable, ...this.contextTable}
        ).leftJoin({...this.assocModelTable}, 'associated_model.id', 'field_context.associated_model_id')
            .select(
                {
                    // list defining fields
                    model: 'model.name',
                    context: 'field_context.context',
                    associatedModel: 'associated_model.name',
                    listName: 'field_context.name',

                    // field defining fields
                    name: 'field.name',
                    alias: 'field_list.alias',
                    order: 'field_list.order',
                    default: 'field_list.default',
                    description: this.database.raw('COALESCE(field_list.description, field.description)'),

                    // where is the data
                    schema: 'field.schema',
                    requirement: 'field.requirement',
                    table: 'field.table',
                    column: 'field.column',
                    select: 'field.select',
                    where_clause: 'field.where_clause',
                    group_method: 'field.group_method',

                    // numeric facets
                    dataType: 'field.dataType',
                    binSize: 'field.binSize',
                    single_response: 'field.single_response',
                    log: 'field.log'
                })
            .where('field_context.model_id', this.database.raw('model.id'))
            .andWhere('field_context.id', this.database.raw('field_list.context_id'))
            .andWhere('field_list.field_id', this.database.raw('field.id'))
            .orderBy(
                [
                    'model.id', 'field_context.context', 'associated_model.id', 'field_context.name',
                    {
                        column: this.database.raw('-field_list.order'),
                        order: 'desc'
                    },
                    'field.table'
                ]);
        return query.then((rows: any[]) => {
            rows.forEach(row => {
                this.listManager.addField(row.model, row.associatedModel, row.context, row.listName, row);
            });
        });
    }

    modelList: Map<string, ModelInfo> = new Map<string, { name: string, table: string, column: string }>();
    database: any;
    dbName: string;
    configDB: string;

    get fieldTable(): { field: string } {
        return {field: this.configDB + '.field'};
    }

    get fieldListTable(): { field_list: string } {
        return {field_list: this.configDB + '.field_list'};
    }

    get modelTable(): { model: string } {
        return {model: this.configDB + '.model'};
    };

    get assocModelTable(): { associated_model: string } {
        return {associated_model: this.configDB + '.model'};
    };

    get contextTable(): { field_context: string } {
        return {field_context: this.configDB + '.field_context'};
    }

    loadPromise: Promise<any>;

    constructor(database: any, dbName: string, configDB: string) {
        this.database = database;
        this.dbName = dbName;
        this.configDB = configDB;
        this.loadPromise = Promise.all([this.parseTables(), this.populateFieldLists(), this.loadModelMap(), this.loadProbMap()]);
    }

    loadProbMap() {
        let query = this.database('ncats_unfiltered_counts').select({
            model: 'model',
            filter: 'filter',
            value: 'value',
            count: 'count',
            p: 'p'
        }).where('schema', this.configDB);
        return query.then((rows: any[]) => {
            rows.forEach(row => {
                const key = this.probKey(row.model, row.filter, row.value);
                this.probMap.set(key, {count: row.count, p: row.p});
            });
        });
    }

    parseTables() {
        let query = this.database.raw('show tables from ' + this.dbName);
        return query.then((rows: any) => {
            for (let tableKey in rows[0]) {
                this.tables.push(new DatabaseTable(this.database, this.dbName, rows[0][tableKey]["Tables_in_" + this.dbName]));
            }
            return Promise.all(this.tables.map(t => t.loadPromise));
        });
    }

    loadModelMap() {
        return this.database({...this.modelTable}).select('*').then((rows: any[]) => {
            rows.forEach(row => {
                this.modelList.set(row.name, new ModelInfo(row));
            });
        })
    }

    getPrimaryKey(table: string): string {
        const t = this.tables.find(t => {
            return t.tableName == table;
        });
        return t?.primaryKey || 'id';
    }

    getLinkInformation(fromTable: string, toTable: string): TableLinkInfo {
        let linkInfo = this._getLinkInformation(fromTable, toTable);
        if (!linkInfo) {
            linkInfo = this._getLinkInformation(toTable, fromTable, true);
        }
        if (!linkInfo) {
            throw new Error(`Error building query: Could not find link between ${fromTable} and ${toTable}`);
        }
        return linkInfo;
    }



    private _getLinkInformation(fromTable: string, toTable: string, reverse: boolean = false): TableLinkInfo | null {
        if (DatabaseTable.nonStandardLinks.has(`${fromTable}-${toTable}`)){
            const nonStandardLink = DatabaseTable.nonStandardLinks.get(`${fromTable}-${toTable}`);
            if(nonStandardLink){
                const pieces = nonStandardLink.split(('-'));
                return new TableLinkInfo(pieces[0], pieces[1]);
            }
        }
        if (fromTable === toTable) {
            const selfTable = this.tables.find(table => table.tableName === fromTable);
            if (!selfTable || !selfTable.primaryKey) {
                return null;
            }
            return new TableLinkInfo(selfTable.primaryKey, selfTable.primaryKey);
        }
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

    getJoinTables(rootTable: string, dataTable: string): string[] {
        let joinTables: string[] = [];

        if (dataTable != rootTable) {
            const links = DatabaseTable.getRequiredLinks(dataTable, rootTable)?.slice().reverse() || [];
            joinTables.push(...links);
            joinTables.push(rootTable);
        }
        return joinTables;
    }

    getBaseSetQuery(rootTable: string, facet: FieldInfo, columns?: any) {
        const joinTables = this.getJoinTables(rootTable, facet.table);

        const query = this.database(facet.table);
        if (!columns) {
            query.distinct({value: this.database.raw(facet.select)});
        } else {
            query.select(columns);
        }

        let leftTable = facet.table;
        joinTables.forEach(rightTable => {
            const linkInfo = this.getLinkInformation(leftTable, rightTable);
            query.join(rightTable, `${leftTable}.${linkInfo?.fromCol}`, '=', `${rightTable}.${linkInfo?.toCol}`);
            leftTable = rightTable;
        });

        if (facet.where_clause.length > 0) {
            query.whereRaw(facet.where_clause);
        }
        // console.log(query.toString());
        return query;
    }
}
