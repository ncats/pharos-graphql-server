import {DatabaseConfig} from "../databaseConfig";
import {FieldInfo} from "../FieldInfo";
import {ListContext} from "../listManager";


export class TargetDetails{
    facetName: string;
    knex: any;
    databaseConfig: DatabaseConfig;
    facet: FieldInfo;
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

        const context = new ListContext('Target', '', 'facet', '');
        const list = this.databaseConfig.listManager.listMap.get(context.toString()) || [];
        this.facet = list.find(f => f.name === this.facetName) || new FieldInfo({});
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

    getSequenceVariants(){
        const query = this.knex({sequence_variant: 'sequence_variant', protein: 'protein'}).select({
            residue: 'residue', aa: 'variant', bits: 'bits'
        }).where('dataSource', 'ProKinO')
            .andWhere('protein.uniprot', this.target.uniprot)
            .andWhere('protein.id', this.knex.raw('sequence_variant.protein_id'))
            .orderBy([{column: 'residue', order: 'asc'}, {column: 'bits', order: 'desc'}]);
        return query;
    }

    getSequenceAnnotations() {
        const query = this.knex({sequence_annotation: 'sequence_annotation', protein: 'protein'}).select({
            startResidue: `residue_start`,
            endResidue: `residue_end`,
            type: `sequence_annotation.type`,
            name: `sequence_annotation.name`})
            .where('dataSource', 'ProKinO')
            .andWhere('protein.uniprot', this.target.uniprot)
            .andWhere('protein.id', this.knex.raw('sequence_annotation.protein_id'))
            .andWhere('type', '!=', 'activation loop')
            .orderBy(['startResidue', 'endResidue']);
        return query;
    }

    static LD2JSON(ldObject: any){
        const jsonObject: any = {};
        for (const prop in ldObject) {
            if (ldObject[prop]['@value']) {
                jsonObject[prop] = ldObject[prop]['@value'];
            }
            else if (ldObject[prop]['rdfs:label']) {
                jsonObject[prop] = ldObject[prop]['rdfs:label'];
            }
        }
        return jsonObject;
    }
}
