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
    targetCount = 0;
    diseaseCount = 0;
    ligandCount = 0;

    probMap: Map<string, {count: number, p: number}> = new Map<string, {count: number, p: number}>();
    probKey(model: string, filter: string, value: string) {
        return `${model}-${filter}-${value}`.replace(/[^a-zA-Z0-9\-\s\.]/g, " ");
    }

    unfilteredCounts: Map<string, { value: string, count: number, p: number }[]>
        = new Map<string, { value: string, count: number, p: number }[]>()
    unfilteredCountKey(model: string, filter: string) {
        return `${model}-${filter}`.replace(/[^a-zA-Z0-9\-\s\.]/g, " ");
    }
    getUnfilteredCounts(model: string, filter: string) {
        return this.unfilteredCounts.get(this.unfilteredCountKey(model, filter));
    }

    findValueProbability(model: string, filter: string, value: string) {
        return this.probMap.get(this.probKey(model, filter, value));
    }

    populateFieldLists() {
        const query = this.settingsDB({...this.modelTable, ...this.fieldListTable, ...this.fieldTable, ...this.contextTable}
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
                    description: this.settingsDB.raw('COALESCE(field_list.description, field.description)'),

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
            .where('field_context.model_id', this.settingsDB.raw('model.id'))
            .andWhere('field_context.id', this.settingsDB.raw('field_list.context_id'))
            .andWhere('field_list.field_id', this.settingsDB.raw('field.id'))
            .orderBy(
                [
                    'model.id', 'field_context.context', 'associated_model.id', 'field_context.name',
                    'field_list.order', 'field.table'
                ]);
        return query.then((rows: any[]) => {
            rows.forEach(row => {
                this.listManager.addField(row.model, row.associatedModel, row.context, row.listName, row);
            });
        });
    }

    modelList: Map<string, ModelInfo> = new Map<string, { name: string, table: string, column: string }>();
    communityDataList: Map<string, any[]> = new Map<string, any[]>();
    communityDataSequenceList: Map<string, any> = new Map<string, any>();
    database: any;
    dbName: string;
    settingsDB: any;
    mondo2id: Map<string, string[]> = new Map<string, string[]>();
    id2mondo: Map<string, string[]> = new Map<string, string[]>();

    get fieldTable(): { field: string } {
        return {field: 'field'};
    }

    get fieldListTable(): { field_list: string } {
        return {field_list: 'field_list'};
    }

    get modelTable(): { model: string } {
        return {model: 'model'};
    };

    get communityDataTable(): {community_data: string} {
        return {community_data: 'community_data'};
    }

    get communitySequenceDataTables(): {community_sequence_data: string, community_sequence_tracks: string} {
        return {
            community_sequence_data: 'community_sequence_data',
            community_sequence_tracks: 'community_sequence_tracks'
        };
    }

    get assocModelTable(): { associated_model: string } {
        return {associated_model: 'model'};
    };

    get contextTable(): { field_context: string } {
        return {field_context: 'field_context'};
    }

    loadPromise: Promise<any>;

    constructor(database: any, dbName: string, settingsConfig: any) {
        this.database = database;
        this.dbName = dbName;
        this.settingsDB = require('knex')(settingsConfig);
        this.loadPromise = Promise.all([
            this.parseTables(),
            this.populateFieldLists(),
            this.loadModelMap(),
            this.loadCounts(),
            this.loadMondoMap(),
            this.loadCommunityAPIs()
        ]);
    }
    loadCommunityAPIs() {
        const query = this.settingsDB({...this.communityDataTable}).select('*').then((rows: any[]) => {
            rows.forEach(row => {
                const key = row.model + '-' + row.data;
                const list = this.communityDataList.get(key) || [];
                this.communityDataList.set(key, list);
                list.push(row);
            });
        });
        const seqQuery = this.settingsDB({...this.communitySequenceDataTables})
            .select({
                code: 'code',
                category_label: 'community_sequence_data.label',
                category_type: 'community_sequence_data.trackType',
                track_label: 'community_sequence_tracks.label',
                instructions: 'community_sequence_tracks.instructions',
                track_type: 'community_sequence_tracks.trackType',
                adapter: 'community_sequence_tracks.adapter',
                url: 'community_sequence_tracks.url',
                tooltip: 'community_sequence_tracks.tooltip',
                row: 'community_sequence_tracks.row',
                filter: 'community_sequence_tracks.filter'
            })
            .whereRaw('community_sequence_tracks.sequence_category = community_sequence_data.code')
            .where('community_sequence_data.default', true)
            .then((rows: any[]) => {
                rows.forEach(row => {
                    const appendTrack = (list: any[], currentRow: any) => {
                        list.push({
                            name: row.code + '-' + row.row,
                            row: row.row,
                            label: row.track_label,
                            instructions: row.instructions,
                            filter: JSON.parse(row.filter),
                            trackType: row.track_type,
                            data: [{
                                adapter: row.adapter,
                                url: row.url
                            }],
                            tooltip: row.tooltip
                        });
                    }
                    if (this.communityDataSequenceList.has(row.code)) {
                        const categoryObj = this.communityDataSequenceList.get(row.code);
                        appendTrack(categoryObj.tracks, row);
                    } else {
                        const categoryObj = {
                            name: row.code,
                            label: row.category_label,
                            trackType: row.category_type,
                            tracks: []
                        };
                        appendTrack(categoryObj.tracks, row);
                        this.communityDataSequenceList.set(row.code, categoryObj);
                    }
                });
            });
    }
    loadMondoMap() {
        const query = this.database('mondo_xref').distinct({
            mondoid: 'mondoid',
            otherid: this.database.raw('concat(db, \':\', value)')
        });
        const noMondoQuery = this.database('disease').distinct({
            mondoid: 'ncats_name',
            otherid: 'did'
        }).whereNotNull('did').whereNull('mondoid');
        return query.union(noMondoQuery).then((res: any[]) => {
            res.forEach((row: any) => {
                let list = this.mondo2id.get(row.mondoid) || [];
                list.push(row.otherid);
                this.mondo2id.set(row.mondoid, list);
                list = this.id2mondo.get(row.otherid) || [];
                list.push(row.mondoid);
                this.id2mondo.set(row.otherid, list);
            })
            res;
        })
    }
    setUnfilteredCounts(db: any) {
        return db('unfiltered_counts').select(['model','filter','value','count','p'])
            .then((res: any[]) => {
                res.forEach(row => {
                    const pmKey = this.probKey(row.model, row.filter, row.value);
                    this.probMap.set(pmKey, {count: row.count, p: row.p});

                    const ucKey = this.unfilteredCountKey(row.model, row.filter);
                    let list: { value: string, count: number, p: number }[] = [];
                    if (this.unfilteredCounts.has(ucKey)) {
                        list = this.unfilteredCounts.get(ucKey) || [];
                    } else {
                        this.unfilteredCounts.set(ucKey, list);
                    }
                    list.push({value: row.value, count: row.count, p: row.p});
                });
            });
    }

    loadCounts() {
        const targetCount = this.database('protein').count({count: 'id'});
        const diseaseCount = this.database('ncats_disease').count({count: 'id'});
        const ligandCount = this.database('ncats_ligands').count({count: 'id'});
        return Promise.all([targetCount, diseaseCount, ligandCount]).then((rows: any[]) =>  {
            this.targetCount = rows[0][0].count;
            this.diseaseCount = rows[1][0].count;
            this.ligandCount = rows[2][0].count;
        })
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
        return this.settingsDB({...this.modelTable}).select('*').then((rows: any[]) => {
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
