import {QueryFacet, FacetFactory} from "./facetQuery";

export class FilteringFacet extends QueryFacet {
    alias: string = "";
    allowedValues: string[] = [];

    constructor(json: any) {
        super(FacetFactory.GetFacet(json.facet, false));
        if (json && json.values && json.values.length > 0) {
            this.allowedValues = json.values;
        }
    }

    public getFacetConstraintQuery(tcrd: any) {
        let query = tcrd.db(QueryFacet.listToObject(this.tables))
            .select("protein.id")
            .whereIn(tcrd.db.raw(this.rawSelect), this.allowedValues);
        if(this.whereClause.length > 0){
            query.whereRaw(this.whereClause);
        }
        this.addProteinLink(query, tcrd);
        return query;
    }
}