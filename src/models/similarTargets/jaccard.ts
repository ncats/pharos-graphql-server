import {DatabaseConfig} from "../databaseConfig";
import {FacetInfo} from "../FacetInfo";
import {DatabaseTable} from "../databaseTable";


export class Jaccard{

    knex: any;
    dbConfig: DatabaseConfig;
    match: string;
    facet: FacetInfo;
    rootTable: string;
    matchQuery: string;
    keyString: string;

    constructor(similarity: {match: string, facet: string, matchQuery: string}, rootTable: string, knex: any, dbConfig: DatabaseConfig) {
        this.match = similarity.match;
        this.matchQuery = similarity.matchQuery;
        this.knex = knex;
        this.dbConfig = dbConfig;
        this.rootTable = rootTable;
        const rootTableObj = this.dbConfig.tables.find(table => table.tableName === this.rootTable);
        this.keyString = `${rootTableObj?.tableName}.${rootTableObj?.primaryKey}`;
        this.facet = new FacetInfo(this.dbConfig.getFacetConfig(this.rootTable ,similarity.facet));
    }

    getListQuery(forList: boolean) {
        if(!this.facet.dataTable) {
            return null;}
        const matchCountQuery = this.getCountForMatch();
        const testCountQuery = this.getCountForTest();
        const overlapQuery = this.getOverlapQuery();

        let columns: any = {protein_id: 'testID'};
        if(forList){
            columns = {
                protein_id: 'testID',
                overlap: 'n_union',
                commonOptions: 'commonOptions',
                baseSize: this.knex.raw(`(${matchCountQuery})`),
                testSize: this.knex.raw(`(${testCountQuery})`),
                jaccard: this.knex.raw(`n_union / ((${matchCountQuery}) + (${testCountQuery}) - n_union)`)
            }
        }
        const similarityQuery = this.knex({overlap: overlapQuery}).select(columns);
        // console.log(similarityQuery.toString());
        return similarityQuery;
    }



    getOverlapQuery() {
        const query = this.getBaseSetQuery(
            {
                testID : this.keyString,
                commonOptions: this.knex.raw(`group_concat(distinct ${this.facet.select} separator '|')`),
                n_union: this.knex.raw(`count(distinct ${this.facet.select})`)
            });
        query.whereIn(this.knex.raw(this.facet.select), this.getOptionsForMatch());
        query.groupBy(this.keyString);
        return query;
    }

    getCountForTest(){
        const testSetQuery = this.getBaseSetQuery({value: this.knex.raw(`count(distinct ${this.facet.select})`)});
        return testSetQuery.where(this.knex.raw(`${this.keyString} = testID`));
    }

    getCountForMatch(){
        const baseSetQuery = this.getBaseSetQuery({value: this.knex.raw(`count(distinct ${this.facet.select})`)});
        return baseSetQuery.where(this.knex.raw(this.matchQuery));
    }

    getOptionsForMatch(){
        const baseSetQuery = this.getBaseSetQuery();
        return baseSetQuery.where(this.knex.raw(this.matchQuery));
    }
    getOptionsForTest(){
        const testSetQuery = this.getBaseSetQuery();
        return testSetQuery.where(this.knex.raw(`${this.keyString} = testID`));
    }

    getJoinTables(){
        let joinTables: string[] = [];

        if (this.facet.dataTable != this.rootTable) {
            const links = DatabaseTable.getRequiredLinks(this.facet.dataTable, this.rootTable) || [];
            joinTables.push(...links);
            joinTables.push(this.rootTable);
        }
        return joinTables;
    }

    getBaseSetQuery(columns?: any){
        const joinTables = this.getJoinTables();

        const query = this.knex(this.facet.dataTable);
        if(!columns) {
            query.distinct({value: this.knex.raw(this.facet.select)});
        }
        else{
            query.select(columns);
        }

        let leftTable = this.facet.dataTable;
        joinTables.forEach(rightTable => {
            const linkInfo = this.dbConfig.getLinkInformation(leftTable, rightTable);
            query.join(rightTable, `${leftTable}.${linkInfo?.fromCol}`, '=', `${rightTable}.${linkInfo?.toCol}`);
            leftTable = rightTable;
        });

        if (this.facet.whereClause.length > 0) {
            query.whereRaw(this.facet.whereClause);
        }
        return query;
    }


}
