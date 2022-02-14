import now from "performance-now";
import {FieldInfo} from "./FieldInfo";
import {DatabaseConfig, ModelInfo} from "./databaseConfig";
// @ts-ignore
import * as CONSTANTS from "../constants";
import {QueryDefinition} from "./queryDefinition";
import {IBuildable} from "./IBuildable";
import {SqlTable} from "./sqlTable";

export abstract class DataModelList implements IBuildable {
    abstract addModelSpecificFiltering(query: any, list: boolean): void;

    abstract defaultSortParameters(): { column: string, order: string } [];

    abstract getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string;

    abstract tableJoinShouldFilterList(table: SqlTable): boolean;

    batch: string[] = [];
    term: string = '';
    fields: string[] = [];
    warnings: string[] = [];
    rootTable: string;
    keyColumn: string;
    noOptimization: boolean = false;
    filteringFacets: FieldInfo[] = [];
    facetsToFetch: FieldInfo[] = [];
    dataFields: FieldInfo[] = [];

    structureQueryHash: string = '';
    sequenceQueryHash: string = '';
    associatedTarget: string = '';
    associatedDisease: string = '';
    associatedSmiles: string = '';
    querySequence: string = '';
    associatedStructureMethod: string = 'sim';
    associatedStructure: string = '';
    associatedLigand: string = '';
    similarity: { match: string, facet: string } = {match: '', facet: ''};
    ppiConfidence: number = CONSTANTS.DEFAULT_PPI_CONFIDENCE;
    skip: number | undefined;
    top: number | undefined;
    modelInfo: ModelInfo = {name: '', table: '', column: ''};

    tcrd: any;
    database: any;
    databaseConfig: DatabaseConfig;

    sortField: string = '';
    direction: string = '';

    getAssociatedModel(): string {
        if (this.associatedTarget) {
            return 'Target';
        }
        if (this.associatedDisease) {
            return 'Disease';
        }
        if (this.associatedSmiles || this.associatedLigand) {
            return 'Ligand';
        }
        return '';
    }

    constructor(tcrd: any, modelName: string, json: any, extra?: any) {
        this.tcrd = tcrd;
        this.database = tcrd.db;
        this.databaseConfig = tcrd.tableInfo;
        // @ts-ignore
        this.modelInfo = this.databaseConfig.modelList.get(modelName);
        if (!this.modelInfo) {
            throw new Error('Unknown model: ' + modelName);
        }
        this.rootTable = this.modelInfo.table;
        this.keyColumn = this.modelInfo.column || this.databaseConfig.getPrimaryKey(this.rootTable);

        if (json) {
            if (json.batch) {
                this.batch = json.batch;
            }
            if (json.skip) {
                this.skip = json.skip;
            }
            if (json.top) {
                this.top = json.top;
            }
            if (json.fields) {
                this.fields = json.fields;
            }
        }

        if (json && json.filter) {
            if (json.filter.term) {
                this.term = json.filter.term;
            }
            if (json.filter.associatedTarget) {
                this.associatedTarget = json.filter.associatedTarget;
            }
            if (json.filter.associatedDisease) {
                this.associatedDisease = json.filter.associatedDisease;
            }
            if (json.filter.associatedLigand) {
                this.associatedLigand = json.filter.associatedLigand;
            }
            if (json.filter.sequence) {
                this.querySequence = json.filter.sequence;
            }
            if (json.filter.associatedStructure) {
                const pieces = json.filter.associatedStructure.split('!');
                pieces.forEach((p: string) => {
                    const method = p.toLowerCase().substr(0, 3);
                    if (method === 'sim' || method === 'sub') {
                        this.associatedStructureMethod = method;
                    } else {
                        this.associatedSmiles = p;
                    }
                });
            }
            if (json.filter.similarity) {

                const rawValues = json.filter.similarity.toString().split(',');
                let match = rawValues[0].trim();
                if (match[0] === '(') {
                    match = match.slice(1).trim();
                }
                let facet = rawValues[1].trim();
                if (facet[facet.length - 1] === ')') {
                    facet = facet.slice(0, facet.length - 1).trim();
                }
                this.similarity = {match: match, facet: facet};
            }
            if (json.filter.ppiConfidence) {
                this.ppiConfidence = json.filter.ppiConfidence;
            }
            if (json.filter.order) {
                this.sortField = json.filter.order.substring(1);
                let ch = json.filter.order.charAt(0);
                this.direction = (ch == '^') ? 'asc' : 'desc';
            }
            if (json.filter.noOptimization) {
                this.noOptimization = json.filter.noOptimization;
            }
        }

        if (json && json.facets) {
            if (json.facets === 'all' || json.facets[0] === 'all') {
                this.facetsToFetch = this.databaseConfig.listManager.getAllFields(this, 'facet');
            } else {
                this.facetsToFetch = this.databaseConfig.listManager.getTheseFields(this, 'facet', json.facets);
            }
        } else {
            this.facetsToFetch = this.databaseConfig.listManager.getDefaultFields(this, 'facet');
        }
        if (json && json.filter && json.filter.facets && json.filter.facets.length > 0) {
            const facets = this.databaseConfig.listManager.getTheseFilteringFields(this, 'facet', json.filter.facets);
            this.filteringFacets = facets;
            facets.forEach(filteringFacet => {
                const index = this.facetsToFetch.findIndex(f => f.name === filteringFacet.name);
                if (index >= 0) {
                    this.facetsToFetch.splice(index, 1);
                }
                this.facetsToFetch.unshift(filteringFacet);
            });
        }
    }

    keyString() {
        return this.rootTable + "." + this.keyColumn;
    }

    getFacetQueries() {
        let facetQueries = [];
        for (let i = 0; i < this.facetsToFetch.length; i++) {
            facetQueries.push(this.facetsToFetch[i].getFacetQuery());
        }
        return facetQueries;
    }

    getCountQuery(): any {
        let queryDefinition = QueryDefinition.GenerateQueryDefinition(this,
            [{table: this.rootTable, column: this.keyColumn, group_method: 'count', alias: 'count'} as FieldInfo]);
        const query = queryDefinition.generateBaseQuery(false);
        this.addFacetConstraints(query, this.filteringFacets);
        this.addModelSpecificFiltering(query, false);
        this.captureQueryPerformance(query, "list count");
        // console.log(query.toString());
        return query;
    };

    getListQuery(context: string, innerJoinAll: boolean = false) {
        let dataFields: FieldInfo[];
        if (this.fields && this.fields.length > 0) {
            dataFields = this.databaseConfig.listManager.getTheseFields(this, context, this.fields);
        } else {
            dataFields = this.databaseConfig.listManager.getDefaultFields(this, context);
        }
        if (!dataFields.map(f => f.name).includes(this.sortField)) {
            const sortField = this.databaseConfig.listManager.getOneField(this, context, this.sortField);
            if (sortField) {
                sortField.alias = this.sortField;
                dataFields.push(sortField);
            }
        }
        this.dataFields = dataFields;
        const sortField = dataFields.find(f => f.name && f.name.length > 0 && f.name === this.sortField);

        const queryDefinition = QueryDefinition.GenerateQueryDefinition(this, dataFields);

        const query = queryDefinition.generateBaseQuery(innerJoinAll);

        this.addFacetConstraints(query, this.filteringFacets);
        this.addModelSpecificFiltering(query, true);

        if (queryDefinition.hasGroupedColumns()) {
            query.groupBy(this.keyString());
        }
        this.addSort(query, queryDefinition, sortField);
        if (this.skip) {
            query.offset(this.skip);
        }
        if (this.top) {
            query.limit(this.top);
        }
        this.doSafetyCheck(query);
        // console.log(query.toString());
        return query;
    }

    getUpsetQuery(facetName: string, values: string[]) {
        const query = this.database(this.getUpsetSubQuery(facetName, values).as('subq'))
            .select({
                count: this.database.raw('count(distinct name)'),
                values: 'values'
            }).groupBy('values')
            .orderBy('count', 'desc');
        // console.log(query.toString());
        return query;
    }

    getUpsetSubQuery(facetName: string, values: string[]) {
        const facetInfo = this.databaseConfig.listManager.getOneField(this, 'facet', facetName);
        if (!facetInfo) {
            return null;
        }

        let queryDefinition = QueryDefinition.GenerateQueryDefinition(this,
            [
                new FieldInfo({
                    table: this.rootTable,
                    column: this.keyColumn,
                    alias: 'name'
                } as FieldInfo),
                new FieldInfo({
                    ...facetInfo,
                    group_method: 'group_concat',
                    isForUpsetPlot: true,
                    alias: 'values'
                })
            ]);

        let query = queryDefinition.generateBaseQuery(true);
        this.addFacetConstraints(query, this.filteringFacets, facetInfo.name);
        this.addModelSpecificFiltering(query, false);
        query.whereIn(this.database.raw(facetInfo.select), values);
        query.groupBy(1);
        return query;
    }

    addSort(query: any, queryDefinition: QueryDefinition, sortFieldInfo: FieldInfo | undefined) {
        if (!sortFieldInfo) {
            query.orderBy(this.defaultSortParameters());
            return;
        }
        const sortTable = queryDefinition.getSqlTable(sortFieldInfo);
        let col = "";
        if (sortFieldInfo.group_method) {
            if (sortFieldInfo.alias !== sortFieldInfo.name) {
                col = "`" + sortFieldInfo.alias + "`";
            } else {
                col = sortFieldInfo.group_method + "(`" + sortFieldInfo.alias + "`)";
            }
        } else {
            col = "`" + sortFieldInfo.alias + "`";
        }
        let dir = this.direction;
        if (sortTable.tableName === "disease" && sortFieldInfo.column === "pvalue") { // workaround TCRD bug  https://github.com/unmtransinfo/TCRD/issues/3
            query.orderByRaw((dir === "asc" ? "-" : "") + col + " + 0.0 desc")
        } else if (this.databaseConfig.tables.find(t => t.tableName === sortTable.tableName)?.columnIsNumeric(sortFieldInfo.column)) {
            query.orderByRaw((dir === "asc" ? "-" : "") + col + " desc");
        } else {
            query.orderByRaw(`${col} ${dir}`);
        }
    }

    addFacetConstraints(query: any, filteringFacets: FieldInfo[], facetToIgnore?: string) {
        for (let i = 0; i < filteringFacets.length; i++) {
            if (facetToIgnore == null || (facetToIgnore !== filteringFacets[i].name)) {
                const queries: any[] = [];
                if (filteringFacets[i].allowedValues.length > 0) {
                    queries.push(filteringFacets[i].getFacetConstraintQuery());
                }
                if (filteringFacets[i].upsetValues.length > 0) {
                    queries.push(...filteringFacets[i].getUpsetConstraintQuery());
                }
                if (queries.length === 1){
                    query.join(queries[0].as(`facet${i}`), `facet${i}.id`, this.keyString());
                }
                else {
                    const theRest = queries.splice(1);
                    const unionQuery = queries[0].union(theRest);
                    query.join(unionQuery.as(`facet${i}`), `facet${i}.id`, this.keyString());
                }
            }
        }
    }

    isNull() {
        if (this.batch.length > 0) {
            return false;
        }
        if (this.similarity.match.length > 0) {
            return false;
        }
        if (this.term.length > 0) {
            return false;
        }
        if (this.associatedTarget.length > 0) {
            return false;
        }
        if (this.associatedDisease.length > 0) {
            return false;
        }
        if (this.associatedSmiles.length > 0) {
            return false;
        }
        if (this.associatedLigand.length > 0) {
            return false;
        }
        if (this.filteringFacets.length > 0) {
            return false;
        }
        if (this.querySequence.length > 0) {
            return false;
        }
        return true;
    }

    filterAppliedOnJoin(query: any, table: string) {
        const found = query._statements.find((joins: any) => {
            return joins.joinType === 'inner' &&
                Object.keys(joins.table)[0] === table;
        });
        return !!found;
    }

    doSafetyCheck(query: any) {
        // override to get this to do something
    }

    perfData: QueryPerformanceData[] = [];

    captureQueryPerformance(query: any, description: string) {
        const qpd = new QueryPerformanceData(description);
        this.perfData.push(qpd);
        query.on('query', (data: any) => {
            qpd.start()
        })
            .on('query-response', (data: any) => {
                qpd.finished()
            });
    }

    getElapsedTime(description: string) {
        const qpd = this.perfData.find(qpd => qpd.description == description);
        if (qpd) {
            return qpd.elapsedTime();
        }
        return -1;
    }
}

class QueryPerformanceData {
    startTime: number = -1;
    endTime: number = -1;
    description: string;

    constructor(description: string) {
        this.description = description;
    }

    start() {
        this.startTime = now();
    }

    finished() {
        this.endTime = now();
    }

    elapsedTime() {
        return (this.endTime - this.startTime) / 1000;
    }
}
