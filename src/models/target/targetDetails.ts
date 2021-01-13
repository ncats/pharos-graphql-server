import {DatabaseConfig} from "../databaseConfig";
import {FacetInfo} from "../FacetInfo";


export class TargetDetails{
    facetName: string;
    knex: any;
    databaseConfig: DatabaseConfig;
    facet: FacetInfo;
    target: any;
    top: number;
    skip: number;
    constructor(args: any, target: any, tcrd: any) {
        this.facetName = args.facetName;
        this.knex = tcrd.db;
        this.target = target;
        this.databaseConfig = tcrd.tableInfo;
        this.top = args.top || 10;
        this.skip = args.skip || 0;
        this.facet = new FacetInfo(this.databaseConfig.getFacetConfig('protein', this.facetName));
    }

    getFacetValueCount(){
        const query = this.databaseConfig.getBaseSetQuery('protein', this.facet,
            {value: this.knex.raw(`count(distinct ${this.facet.select})`)})
            .where('protein.uniprot', this.target.uniprot);
        return query;
    }

    getAllFacetValues(){
        const query = this.databaseConfig.getBaseSetQuery('protein', this.facet)
            .where('protein.uniprot', this.target.uniprot)
            .orderBy('value')
            .limit(this.top)
            .offset(this.skip);
        return query;
    }
}
