import now from "performance-now";
import {FacetInfo} from "./FacetInfo";
import {FacetFactory} from "./FacetFactory";

export abstract class DataModelList {
    abstract AllFacets: string[];
    abstract DefaultFacets: string[];
    abstract addModelSpecificConstraints(query: any, db: any): void;
    abstract addLinkToRootTable(query: any, db: any, facet: FacetInfo): void;
    abstract getRequiredTablesForFacet(info: FacetInfo): string[];

    facetFactory: FacetFactory;
    term: string = "";
    rootTable: string;
    keyColumn: string;
    filteringFacets: FacetInfo[] = [];
    facetsToFetch: FacetInfo[] = [];
    ppiTarget: string = "";

    constructor(rootTable: string, keyColumn: string, facetFactory: FacetFactory, json: any, extra?: any) {
        this.rootTable = rootTable;
        this.keyColumn = keyColumn;
        this.facetFactory = facetFactory;

        if (json && json.filter){
            if(json.filter.term){
                this.term = json.filter.term;
            }
            if(json.filter.ppiTarget){
                this.ppiTarget = json.filter.ppiTarget;
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

    getFacetQueries(tcrd: any) {
        let facetQueries = [];
        for (let i = 0; i < this.facetsToFetch.length; i++) {
            facetQueries.push(this.facetsToFetch[i].getFacetQuery(tcrd));
        }
        return facetQueries;
    }

    getCountQuery(tcrd: any): any {
        let query = tcrd.db(this.rootTable)
            .select(tcrd.db.raw('count(distinct ' + this.keyColumn + ') as count'));
        this.addFacetConstraints(query, tcrd, this.filteringFacets);
        this.addModelSpecificConstraints(query, tcrd);
        this.captureQueryPerformance(query, "list count");
        return query;
    };

    addFacetConstraints(query: any, tcrd: any, filteringFacets: FacetInfo[], facetToIgnore?: string) {
        for (let i = 0; i < filteringFacets.length; i++) {
            if (facetToIgnore == null || facetToIgnore != filteringFacets[i].type) {
                let subQuery = filteringFacets[i].getFacetConstraintQuery(tcrd);
                query.whereIn(this.rootTable + ".id", subQuery);
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

    static listToObject(list: string[]) {
        let obj: any = {};
        for (let i = 0; i < list.length; i++) {
            obj[list[i]] = list[i];
        }
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