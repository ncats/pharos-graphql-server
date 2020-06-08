import now from "performance-now";
import {FacetInfo} from "./FacetInfo";
import {FacetFactory} from "./FacetFactory";
import {Config, ConfigKeys, QueryDefinition, SqlTable} from "./config";
import {DatabaseConfig, DatabaseTable} from "./databaseConfig";
// @ts-ignore
import * as CONSTANTS from "../constants";

export abstract class DataModelList {
    abstract AllFacets: string[];
    abstract DefaultFacets: string[];
    abstract addModelSpecificFiltering(query: any, list?: boolean): void;
    abstract addLinkToRootTable(query: any, facet: FacetInfo): void;
    abstract getRequiredTablesForFacet(info: FacetInfo): string[];
    abstract listQueryKey(): ConfigKeys;
    abstract defaultSortParameters(): { column: string, order: string }[];

    facetFactory: FacetFactory;
    term: string = "";
    rootTable: string;
    keyColumn: string;
    filteringFacets: FacetInfo[] = [];
    facetsToFetch: FacetInfo[] = [];

    associatedTarget: string = "";
    associatedDisease: string = "";
    ppiConfidence: number = CONSTANTS.DEFAULT_PPI_CONFIDENCE;
    skip: number = 0;
    top: number = 10;

    tcrd: any;
    database: any;
    databaseConfig: DatabaseConfig;

    sortTable: string = "";
    sortColumn: string = "";
    direction: string = "";

    constructor(tcrd: any, rootTable: string, keyColumn: string, facetFactory: FacetFactory, json: any, extra?: any) {
        this.tcrd = tcrd;
        this.database = tcrd.db;
        this.databaseConfig = tcrd.tableInfo;
        this.rootTable = rootTable;
        this.keyColumn = keyColumn || this.databaseConfig.getPrimaryKey(this.rootTable);
        this.facetFactory = facetFactory;

        if (json) {
            if (json.skip) {
                this.skip = json.skip;
            }
            if (json.top) {
                this.top = json.top;
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
            if (json.filter.ppiConfidence) {
                this.ppiConfidence = json.filter.ppiConfidence;
            }
            if (json.filter.order) {
                this.sortColumn = json.filter.order.substring(1);
                if (this.sortColumn.indexOf('.') > 0) {
                    this.sortTable = this.sortColumn.split('.')[0];
                    this.sortColumn = this.sortColumn.split('.')[1];
                }
                let ch = json.filter.order.charAt(0);
                this.direction = (ch == '^') ? 'asc' : 'desc';
            }
        }

        if (json && json.filter && json.filter.facets && json.filter.facets.length > 0) {
            for (let i = 0; i < json.filter.facets.length; i++) {
                let newFacetInfo = this.facetFactory.GetFacet(
                    this, json.filter.facets[i].facet, json.filter.facets[i].values, extra);
                if (newFacetInfo.dataTable != "" && newFacetInfo.allowedValues.length > 0) {
                    this.filteringFacets.push(newFacetInfo);
                    this.facetsToFetch.push(newFacetInfo);
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
        let query = this.database(this.rootTable)
            .select(this.database.raw('count(distinct ' + this.keyString() + ') as count'));
        this.addFacetConstraints(query, this.filteringFacets);
        this.addModelSpecificFiltering(query);
        this.captureQueryPerformance(query, "list count");
        return query;
    };

    getListQuery() {
        const that = this;
        let dataFields = Config.GetDataFields(this.listQueryKey(), this.sortTable, this.sortColumn);
        const queryDefinition = QueryDefinition.GenerateQueryDefinition(this.rootTable, dataFields);
        let rootTableObject = queryDefinition.getRootTable();
        if (rootTableObject == undefined) {
            return;
        }
        let aggregateAll = (this.databaseConfig.getPrimaryKey(this.rootTable) != this.keyColumn);

        let leftJoins = queryDefinition.getLeftJoinTables();
        let innerJoins = queryDefinition.getInnerJoinTables();

        let query = this.database(queryDefinition.getTablesAsObjectArray(innerJoins))
            .select(queryDefinition.getColumnList());
        if (aggregateAll) {
            query.count({count: this.databaseConfig.getPrimaryKey(this.rootTable)});
        }
        this.addFacetConstraints(query, this.filteringFacets);
        for (let i = 0; i < leftJoins.length; i++) {
            let linkInfo = this.databaseConfig.getLinkInformation(rootTableObject.tableName, leftJoins[i].tableName);
            if (!linkInfo) throw new Error("bad table configuration: " + rootTableObject?.tableName + " + " + leftJoins[i].tableName);
            query.leftJoin(leftJoins[i].tableName + (leftJoins[i].alias ? ' as ' + leftJoins[i].alias : ''), function (this: any) {
                // @ts-ignore
                this.on(rootTableObject.tableName + "." + linkInfo.fromCol, '=', leftJoins[i].alias + "." + linkInfo.toCol);
                if (leftJoins[i].joinConstraint) {
                    this.andOn(that.database.raw(leftJoins[i].joinConstraint));
                }
            });
        }
        for (let i = 0; i < innerJoins.length; i++) {
            if (rootTableObject !== innerJoins[i]) {
                let leftTable = rootTableObject;
                for (let j = 0; j < innerJoins[i].linkingTables.length; j++) {
                    let linkInfo = this.databaseConfig.getLinkInformation(leftTable.tableName, innerJoins[i].linkingTables[j]);
                    if (!linkInfo) throw new Error("bad table configuration: " + leftTable.tableName + " + " + innerJoins[i].linkingTables[j]);
                    query.whereRaw(leftTable.alias + "." + linkInfo.fromCol + "=" + innerJoins[i].linkingTables[j] + "." + linkInfo.toCol);
                    const addtJoinConstraint = DatabaseTable.additionalJoinConstraints(innerJoins[i].tableName, innerJoins[i].alias, this);
                    if (addtJoinConstraint) {
                        query.andWhere(this.database.raw(addtJoinConstraint));
                    }
                    leftTable = new SqlTable(innerJoins[i].linkingTables[j]);
                }
                let linkInfo = this.databaseConfig.getLinkInformation(leftTable.tableName, innerJoins[i].tableName);
                if (!linkInfo) throw new Error("bad table configuration: " + leftTable.tableName + " + " + innerJoins[i].tableName);
                query.whereRaw(leftTable.alias + "." + linkInfo.fromCol + "=" + innerJoins[i].alias + "." + linkInfo.toCol);
                const addtJoinConstraint = DatabaseTable.additionalJoinConstraints(innerJoins[i].tableName, innerJoins[i].alias, this);
                if (addtJoinConstraint) {
                    query.andWhere(this.database.raw(addtJoinConstraint));
                }
            }
        }
        this.addModelSpecificFiltering(query, true);
        if (aggregateAll) {
            query.groupBy(this.keyString());
        }
        this.addSort(query, queryDefinition);
        if (this.skip) {
            query.offset(this.skip);
        }
        if (this.top) {
            query.limit(this.top);
        }
        //console.log(query.toString());
        this.captureQueryPerformance(query, "list count");
        return query;
    }

    addSort(query: any, queryDefinition: QueryDefinition) {
        if (!this.sortColumn) {
            query.orderBy(this.defaultSortParameters());
            return;
        }
        let col = this.sortColumn;
        let dir = this.direction;
        query.orderBy(col, dir);
    }

    addFacetConstraints(query: any, filteringFacets: FacetInfo[], facetToIgnore?: string) {
        for (let i = 0; i < filteringFacets.length; i++) {
            if (facetToIgnore == null || facetToIgnore != filteringFacets[i].type) {
                const sqAlias = filteringFacets[i].type;
                let subQuery = filteringFacets[i].getFacetConstraintQuery().as(sqAlias);
                query.join(subQuery, sqAlias + '.' + this.keyColumn, this.keyString());
            }
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

    static listToObject(list: string[], lastTable: string) {
        let obj: any = {};
        for (let i = 0; i < list.length; i++) {
            if (lastTable != list[i]) {
                obj[list[i]] = list[i];
            }
        }
        obj[lastTable] = lastTable; // because apparently it matters the order you add fields to an object, somehow knex adds tables in this order
        return obj;
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
