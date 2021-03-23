import now from "performance-now";
import {FieldInfo} from "./FieldInfo";
import {FacetFactory} from "./FacetFactory";
import {DatabaseConfig, ModelInfo} from "./databaseConfig";
// @ts-ignore
import * as CONSTANTS from "../constants";
import {QueryDefinition} from "./queryDefinition";
import {IBuildable} from "./IBuildable";
import {SqlTable} from "./sqlTable";

export abstract class DataModelList implements IBuildable {
    abstract addModelSpecificFiltering(query: any, list: boolean, tables: string[]): void;
    abstract getAvailableListFields(): FieldInfo[];
    abstract defaultSortParameters(): { column: string, order: string } [];

    abstract getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string;
    abstract tableNeedsInnerJoin(table: SqlTable): boolean;

    batch: string[] = [];
    facetFactory: FacetFactory;
    term: string = "";
    fields: string[] = [];
    rootTable: string;
    keyColumn: string;
    filteringFacets: FieldInfo[] = [];
    facetsToFetch: FieldInfo[] = [];
    dataFields: FieldInfo[] = [];

    associatedTarget: string = "";
    associatedDisease: string = "";
    similarity: { match: string, facet: string } = {match: '', facet: ''};
    ppiConfidence: number = CONSTANTS.DEFAULT_PPI_CONFIDENCE;
    skip: number | undefined;
    top: number | undefined;
    modelInfo: ModelInfo = {name: '', table: '', column: ''};

    tcrd: any;
    database: any;
    databaseConfig: DatabaseConfig;

    sortField: string = "";
    direction: string = "";

    getAssociatedModel(): string {
        if (this.associatedTarget) {
            return 'Target';
        }
        if (this.associatedDisease) {
            return 'Disease';
        }
        return '';
    }

    get AllFacets(): string[] {
        const fieldInfo = this.databaseConfig.getAvailableFields(this.modelInfo.name, 'facet');
        return fieldInfo.map((facet: FieldInfo) => facet.name) || [];
    }

    get DefaultFacets() {
        const fieldInfo = this.databaseConfig.getDefaultFields(this.modelInfo.name, 'facet');
        return fieldInfo.map((facet: FieldInfo) => facet.name) || [];
    };

    constructor(tcrd: any, modelName: string, json: any, extra?: any) {
        this.tcrd = tcrd;
        this.database = tcrd.db;
        this.databaseConfig = tcrd.tableInfo;
        // @ts-ignore
        this.modelInfo = this.databaseConfig.modelList.get(modelName);
        if(!this.modelInfo){
            throw new Error('Unknown model: ' + modelName);
        }
        this.rootTable = this.modelInfo.table;
        this.keyColumn = this.modelInfo.column || this.databaseConfig.getPrimaryKey(this.rootTable);
        this.facetFactory = new FacetFactory();

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
        }

        if (json && json.filter && json.filter.facets && json.filter.facets.length > 0) {
            for (let i = 0; i < json.filter.facets.length; i++) {
                let fieldInfo = this.facetFactory.GetFacet(
                    this, json.filter.facets[i].facet, json.filter.facets[i].values, extra);
                if (fieldInfo.table != "" && fieldInfo.allowedValues.length > 0) {
                    this.filteringFacets.push(fieldInfo);
                    this.facetsToFetch.push(fieldInfo);
                }
            }
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
        this.addModelSpecificFiltering(query, false, []);
        this.captureQueryPerformance(query, "list count");
        return query;
    };

    getListQuery() {
        let dataFields: FieldInfo[];
        if (this.fields && this.fields.length > 0) {
            dataFields = this.GetDataFields('list');
        } else {
            dataFields = this.getAvailableListFields();
        }
        if(!dataFields.map(f => f.name).includes(this.sortField)) {
            this.pushOneDataField(this.sortField, 'list', dataFields);
        }
        this.dataFields = dataFields;
        const sortField = dataFields.find(f => f.name && f.name.length > 0 && f.name === this.sortField);

        const queryDefinition = QueryDefinition.GenerateQueryDefinition(this, dataFields);

        const query = queryDefinition.generateBaseQuery(false);

        this.addFacetConstraints(query, this.filteringFacets);
        this.addModelSpecificFiltering(query, true, this.dataFields.map(f => f.table));

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
        // console.log(query.toString());
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
            col = sortFieldInfo.group_method + "(`" + sortFieldInfo.alias + "`)";
        } else {
            col = "`" + sortFieldInfo.alias + "`";
        }
        let dir = this.direction;
        if (sortTable.tableName === "disease" && sortFieldInfo.column === "pvalue") { // workaround TCRD bug  https://github.com/unmtransinfo/TCRD/issues/3
            query.orderByRaw((dir === "asc" ? "-" : "") + col + " + 0.0 desc")
        } else if (this.databaseConfig.tables.find(t => t.tableName === sortTable.tableName)?.columnIsNumeric(sortFieldInfo.column)) {
            query.orderByRaw((dir === "asc" ? "-" : "") + col + " desc");
        } else {
            query.orderBy(col, dir);
        }
    }

    addFacetConstraints(query: any, filteringFacets: FieldInfo[], facetToIgnore?: string) {
        for (let i = 0; i < filteringFacets.length; i++) {
            if (facetToIgnore == null || facetToIgnore != filteringFacets[i].name) {
                const sqAlias = filteringFacets[i].name;
                let subQuery = filteringFacets[i].getFacetConstraintQuery().as(sqAlias);
                query.join(subQuery, sqAlias + '.' + this.keyColumn, this.keyString());
            }
        }
    }

    isNull() {
        if (this.batch.length > 0) {
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
        if (this.filteringFacets.length > 0) {
            return false;
        }
        return true;
    }

    GetDataFields(context: string): FieldInfo[] {
        const dataFields: FieldInfo[] = [];
        dataFields.push(new FieldInfo({table: this.modelInfo.table, column: this.modelInfo.column, alias: 'id'} as FieldInfo));

        this.fields.forEach(field => {
            this.pushOneDataField(field, context, dataFields);
        });
        return dataFields;
    }


    private pushOneDataField(field: string, context: string, dataFields: FieldInfo[]) {
        const fieldInfo = this.databaseConfig.getOneField(this.modelInfo.name, context, this.getAssociatedModel(), '', field);
        if (fieldInfo) {
            fieldInfo.alias = field;
            dataFields.push(fieldInfo);
        }
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
