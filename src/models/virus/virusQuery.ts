// @ts-ignore
import * as CONSTANTS from "../../constants";

export class Virus {
    taxonomyID: string;
    name: string;
    nucleic1: string;
    nucleic2: string;
    order: string;
    family: string;
    subfamily: string;
    genus: string;
    species: string;
    interactionDetails: ViralProteinInteraction[] = [];

    constructor(row: any) {
        this.taxonomyID = row.taxonomyID;
        this.name = row.name;
        this.nucleic1 = row.nucleic1;
        this.nucleic2 = row.nucleic2;
        this.order = row.order;
        this.family = row.family;
        this.subfamily = row.subfamily;
        this.genus = row.genus;
        this.species = row.species;
    }

    static getQuery(knex: any, targetID: number): any {
        const columnList = {
            taxonomyID: "virus.virusTaxid",
            name: "virus.name",
            nucleic1: "virus.nucleic1",
            nucleic2: "virus.nucleic2",
            order: "virus.order",
            family: "virus.family",
            subfamily: "virus.subfamily",
            genus: "virus.genus",
            species: "virus.species",
            finalLR: "viral_ppi.finalLR",
            protein_name: "viral_protein.name",
            protein_ncbi: "viral_protein.ncbi",
            dataSource: "viral_ppi.dataSource"
        };

        const tableList = {
            virus: "virus", viral_ppi: "viral_ppi", viral_protein: "viral_protein", protein: "protein", t2tc: "t2tc"
        };

        return knex(tableList).select(columnList)
            .where('protein.id', knex.raw('viral_ppi.protein_id'))
            .where('viral_ppi.viral_protein_id', knex.raw('viral_protein.id'))
            .where('viral_ppi.finalLR','>=', CONSTANTS.VIRAL_LR_CUTOFFF)
            .where('viral_protein.virus_id', knex.raw('virus.virusTaxid'))
            .where('protein.id', knex.raw('t2tc.protein_id'))
            .where('t2tc.target_id', targetID)
            .orderBy('virusTaxid');
    }

    static parseResult(rows: any[]) : Virus[] {

        let getVirus = (row: any) => {
            let virusObj = returnArray.find(v => v.taxonomyID === row.taxonomyID);
            if(virusObj) return virusObj;
            virusObj = new Virus(row);
            returnArray.push(virusObj);
            return virusObj;
        };

        let returnArray : Virus[] = [];
        for(let row of rows){
            let virusObj = getVirus(row);
            virusObj.interactionDetails.push(row);
        }
        return returnArray;
    }
}

export class ViralProteinInteraction {
    name: string;
    ncbi: string;
    dataSource: string;
    finalLR: number;

    constructor(row: any) {
        this.name = row.protein_name;
        this.ncbi = row.protein_ncbi;
        this.dataSource = row.dataSource;
        this.finalLR = row.finalLR;
    }
}
