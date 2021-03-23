import {DatabaseTable, TableLink, TableLinkInfo} from "./databaseTable";
import {FieldInfo} from "./FieldInfo";

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
    availableFieldMap: Map<string, FieldInfo[]> = new Map<string, FieldInfo[]>();

    getAvailableFields(model: string, context: string = '', associatedModel: string = '', listName: string = ''): FieldInfo[] {
        if(context === 'facet'){ // for facets, only the the exact match
            const key = new FieldList(model, context, associatedModel, '').listKey;
            const list = this.availableFieldMap.get(key)?.map(each => each.copy());
            if (list && list.length > 0) {
                return list;
            }
        }
        else if(context === 'list'){ // for lists, fall back on the model free lists
            const key = new FieldList(model, context, associatedModel, '').listKey;
            const list = this.availableFieldMap.get(key)?.map(each => each.copy());
            if (list && list.length > 0) {
                return list;
            }
            if(associatedModel){
                const key = new FieldList(model, context, '', '').listKey;
                const list = this.availableFieldMap.get(key)?.map(each => each.copy());
                if (list && list.length > 0) {
                    return list;
                }
            }
        }
        else if(context === 'download') { // for downloads, get the full lists, across all the download groups
            const key = new FieldList(model, '', associatedModel, '').listKey;
            const list = this.availableFieldMap.get(key)?.map(each => each.copy());
            if (list && list.length > 0) {
                return list;
            }
        }
        return [];
    }

    getDefaultFields(model: string, context: string = '', associatedModel: string = '', listName: string = ''): FieldInfo[] {
        return this.getAvailableFields(model, context, associatedModel, listName)
            .filter(fInfo => fInfo.default).sort(((a, b) => a.order - b.order));
    }

    getOneField(model: string, context: string = '', associatedModel: string, listName: string, name: string): FieldInfo | undefined {
        let list = this.getAvailableFields(model, context, associatedModel, listName);
        let match = list.find((fieldInfo: FieldInfo) => fieldInfo.name === name);
        if (match) {
            return match.copy();
        }
        list = this.getAvailableFields(model, 'download', '', 'Single Value Fields');
        match = list.find((fieldInfo: FieldInfo) => fieldInfo.name === name);
        return match?.copy();
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
                    table: 'field.table',
                    column: 'field.column',
                    select: 'field.select',
                    where_clause: 'field.where_clause',
                    group_method: 'field.group_method',

                    // when facets are precalculated
                    null_table: 'field.null_table',
                    null_column: 'field.null_column',
                    null_count_column: 'field.null_count_column',
                    null_where_clause: 'field.null_where_clause',

                    // numeric facets
                    dataType: 'field.dataType',
                    binSize: 'field.binSize',
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
                ['parseJson', 'parseJsonContextFree'].forEach((method: string) => {
                    // @ts-ignore
                    const key = FieldList[method](row).listKey;
                    const fieldInfo = new FieldInfo(row);
                    if (this.availableFieldMap.has(key)) {
                        const existingList = this.availableFieldMap.get(key) || [];
                        if (!existingList.map(f => f.name).includes(row.name)) {
                            existingList.push(fieldInfo);
                        }
                    } else {
                        this.availableFieldMap.set(key, [fieldInfo]);
                    }
                });
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
        this.loadPromise = Promise.all([this.parseTables(), this.populateFieldLists(), this.loadModelMap()]);
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
        let query = this.database({...this.modelTable}).select('*').then((rows: any[]) => {
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
