import {QueryFacet, FacetQuery} from "./facetQuery";
import {QueryFilter} from "./query.filter";

export class QueryArguments{
    proteinList: string[] = [];
    batch: string[] = [];
    filter: QueryFilter;
    facets: FacetQuery[] = [];

    constructor(json: any) {
        this.filter = new QueryFilter(json.filter);
        if(json.proteinList) {
            this.proteinList = json.proteinList;
        }
        if(json.batch) {
            this.batch = json.batch;
        }
        if(json.facets == "all"){
            this.facets = QueryFacet.getFacetsFromList(QueryFacet.AllTargetFacets(), this.isNull());
        }
        else {
            this.facets = QueryFacet.getFacetsFromList(json.facets, this.isNull());
        }
    }

    isNull(){
        if(this.batch.length > 0) {
            return false;
        }
        if(this.proteinList.length > 0) {
            return false;
        }
        if(this.filter.term.length > 0) {
            return false;
        }
        if(this.filter.facets.length > 0) {
            return false;
        }
        return true;
    }
}