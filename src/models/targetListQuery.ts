import {FilteringFacet} from "./query.filter.facet";
import {FacetType} from "./facetQuery";
import {QueryArguments} from "./query.arguments";
import {Query} from "./query";

export class TargetListQuery extends Query{
    constructor() {
        super();
    }

    getCountQuery(tcrd:any, args: QueryArguments){
        let query = tcrd.db("protein")
            .count({count:"protein.id"});
        TargetListQuery.addBatchConstraint(query, args.batch);
        TargetListQuery.addFacetConstraints(query, tcrd, args.filter.facets);
        TargetListQuery.addProteinListConstraint(query, args.proteinList);
        this.capturePerformanceData(query);
        return query;
    }

    static addFacetConstraints(query: any, tcrd: any, filteringFacets: FilteringFacet[], facetToIgnore?: FacetType) {
        for (let i = 0; i < filteringFacets.length; i++) {
            if(facetToIgnore == null || facetToIgnore != filteringFacets[i].facetType) {
                let subQuery = filteringFacets[i].getFacetConstraintQuery(tcrd);
                query.whereIn('protein.id', subQuery);
            }
        }
    }

    static addBatchConstraint(query: any, batch: string[]) {
        if (!!batch && batch.length > 0) {
            query.andWhere
            (function (builder: any) {
                builder.whereIn('protein.uniprot', batch)
                    .orWhereIn('protein.sym', batch)
                    .orWhereIn('protein.stringid', batch)
            });
        }
    };

    static addProteinListConstraint(query: any, proteinList: string[]) {
        if (!!proteinList && proteinList.length > 0) {
            query.whereIn('protein.id', proteinList);
        }
    };

    static addTargetProteinLink = function (query: any, tcrd: any) {
        query.andWhere('target.id', tcrd.db.raw('t2tc.target_id'))
            .andWhere('protein.id', tcrd.db.raw('t2tc.protein_id'));
    };
}