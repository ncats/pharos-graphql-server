import {FilteringFacet} from "./query.filter.facet";

export class QueryFilter {
    facets: FilteringFacet[] = [];
    term: string = "";

    constructor(json: any) {
        if (json && json.term) {
            this.term = json.term;
        }
        if (json && json.facets && json.facets.length > 0) {
            for (let i = 0; i < json.facets.length; i++) {
                let newFacet = new FilteringFacet(json.facets[i]);
                if (newFacet.keyColumn != "" && newFacet.allowedValues.length > 0) {
                    this.facets.push(newFacet);
                }
            }
        }
    }
}