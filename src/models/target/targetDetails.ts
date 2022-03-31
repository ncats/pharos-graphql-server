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

    getNearestTclin() {
        const query = this.knex({
            nearest: 'kegg_nearest_tclin',
            tclinTarget: 'target',
            tclinT2TC: 't2tc',
            tclinProtein: 'protein',
            selfPathway: 'pathway',
            tclinPathway: 'pathway'
        }).select(['direction', 'distance'])
            .select({
                tdl: 'tclinTarget.tdl',
                fam: this.knex.raw(`case fam when 'IC' then 'Ion Channel' when 'TF; Epigenetic' then 'TF-Epigenetic' when 'TF' then 'Transcription Factor' when 'NR' then 'Nuclear Receptor' else if(fam is null,'Other',fam) end`),
                sym: 'tclinProtein.sym',
                uniprot: 'tclinProtein.uniprot',
                protein_id: 'tclinProtein.id',
                tcrdid: 'tclinTarget.id',
                preferredSymbol: 'tclinProtein.preferred_symbol',
                name: 'tclinProtein.description',
                pwid: 'tclinPathway.id',
                type: 'tclinPathway.pwtype',
                pwname: 'tclinPathway.name',
                url: 'tclinPathway.url',
                sourceID: 'tclinPathway.id_in_source'
                }
            )
            .where('nearest.protein_id', this.target.protein_id)
            .andWhere('nearest.tclin_id', this.knex.raw('tclinTarget.id'))
            .andWhere('tclinT2TC.target_id', this.knex.raw('tclinTarget.id'))
            .andWhere('tclinProtein.id', this.knex.raw('tclinT2TC.protein_id'))
            .andWhere('nearest.protein_id', this.knex.raw('selfPathway.protein_id'))
            .andWhere('tclinProtein.id', this.knex.raw('tclinPathway.protein_id'))
            .andWhere('selfPathway.id_in_source', this.knex.raw('tclinPathway.id_in_source'))
            .andWhere('selfPathway.pwtype', 'KEGG');
        return query.then((rows: any[]) => {
            const processOneRow = (row: any, map: Map<number, any>) => {
                let obj = map.get(row.tcrdid);
                if (!obj) {
                    obj = {};
                    obj.distance = row.distance;
                    obj.tClinTarget = {
                        tdl: row.tdl,
                        fam: row.fam,
                        sym: row.sym,
                        uniprot: row.uniprot,
                        tcrdid: row.tcrdid,
                        preferredSymbol: row.preferredSymbol,
                        name: row.name,
                    };
                    obj.sharedPathways = [];
                    map.set(row.tcrdid, obj);
                }
                obj.sharedPathways.push({
                    pwid: row.pwid,
                    type: row.type,
                    name: row.pwname,
                    url: row.url,
                    sourceID: row.sourceID
                })
            }

            const upTargetMap: Map<number, any> = new Map<number, any>();
            const downTargetMap: Map<number, any> = new Map<number, any>();
            rows.forEach((row: any) => {
               if (row.direction === 'upstream') {
                   processOneRow(row, upTargetMap);
               } else {
                   processOneRow(row, downTargetMap);
               }
            });
            return {
                upstream: upTargetMap.values(),
                downstream: downTargetMap.values()
            };
        });

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
