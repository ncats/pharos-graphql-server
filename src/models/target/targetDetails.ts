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
    getTaus() {
        const itypes = [
            'HPA Protein Tissue Specificity Index',
            'HPM Protein Tissue Specificity Index',
            'HPA RNA Tissue Specificity Index',
            'GTEx Tissue Specificity Index',
            'GTEx Tissue Specificity Index - Male',
            'GTEx Tissue Specificity Index - Female'
        ];
        return this.knex('tdl_info').select({name: 'itype', value: 'number_value'}).whereIn('itype', itypes)
            .andWhere('protein_id', this.target.protein_id);
    }
    getExpressionTree() {
        const expressionQuery = this.knex('expression').select(
            {
                id: 'id',
                etype: 'etype',
                tissue: 'tissue',
                value: this.knex.raw('coalesce(source_rank, number_value / 5)'),
                evidence: 'evidence',
                uberon_id: 'uberon_id'
            }
            ).where('protein_id', this.target.protein_id)
            .whereNotNull('uberon_id');
        const gtexQuery = this.knex('gtex').select(
            {
                id: 'id',
                etype: this.knex.raw('"GTEx"'),
                tissue: 'tissue',
                value: 'tpm_rank',
                evidence: this.knex.raw('NULL'),
                uberon_id: 'uberon_id'
            }
            ).where('protein_id', this.target.protein_id)
            .whereNotNull('uberon_id');
        const exprUberonIDs = this.knex('expression').select(
            {uberon_id: 'uberon_id'})
            .where('protein_id', this.target.protein_id);
        const ancestorUberonQuery = this.knex({expression: 'expression', uberon_ancestry: 'uberon_ancestry'})
            .select({uberon_id: 'ancestor_uberon_id'})
            .where('protein_id', this.target.protein_id)
            .andWhere('expression.uberon_id', this.knex.raw('uberon_ancestry.uberon_id'))
            .whereNotIn('ancestor_uberon_id', ['GO:0005623']);
        const hierarchyQuery = this.knex({uberon_parent: 'uberon_parent', uberon: 'uberon'})
            .join(exprUberonIDs.union(ancestorUberonQuery).as('subq'), 'uberon.uid', 'subq.uberon_id')
            .select(['uberon.uid', 'uberon_parent.parent_id', 'name'])
            .where('uberon.uid', this.knex.raw('uberon_parent.uid'));

        return Promise.all([hierarchyQuery, expressionQuery.union(gtexQuery)]).then((rows: any) => {
            const hierarchyRows = rows[0];
            const expressionRows = rows[1];

            const uberonDict = new Map<string, any>();
            const parentDict = new Map<string, string[]>();
            hierarchyRows.forEach((row: any) => {
                const tissueObj = {uid: row.uid, name: row.name, childData: new Map<number, number>(), parents: [], children: [], data: []}
                uberonDict.set(row.uid, tissueObj);
                if (parentDict.has(row.uid)) {
                    const list = parentDict.get(row.uid) || [];
                    list.push(row.parent_id);
                } else {
                    parentDict.set(row.uid, [row.parent_id]);
                }
            });

            const nonRoots: string[] = [];
            uberonDict.forEach((v, k) => {
                const parents = parentDict.get(k) || [];
                v.parents = parents;
                parents.forEach(uid => {
                    const oneParent = uberonDict.get(uid);
                    if (oneParent) {
                        if (!nonRoots.includes(k)) {
                            nonRoots.push(k);
                        }
                        oneParent.children.push(v);
                    }
                });
            });
            expressionRows.forEach((row: any) => {
                const obj = uberonDict.get(row.uberon_id);
                if (obj) {
                    obj.data.push(row);
                }
            })
            nonRoots.forEach(nonRoot => {
                uberonDict.delete(nonRoot);
            });
            uberonDict.forEach((v,k) => {
                this.calcChildData(v);
            })
            this.collapseDictionary(uberonDict)
            return {
                uberonDict: Array.from(uberonDict.values())
            }
        });
    }
    trimNode(node: any){
        for (let i = node.children.length - 1 ; i >= 0 ; i--){
            const child = node.children[i];
            this.trimNode(child);
            if (child.data.length === 0 && child.children.length === 1) {
                node.children[i] = child.children[0];
            }
        }
    }
    collapseDictionary(dict: Map<string, any>) {
        dict.forEach((v, k) => {
            this.trimNode(v);
        })

    }
    tryPushValue(map: Map<number, number>, id: number, val: number){
        if (map.has(id)){
            return;
        }
        map.set(id, val);
    }
    calcChildData(node: any) {
        const map: Map<number, number> = node.childData;
        if (map.size > 0) {
            return map;
        }
        node.data.forEach((dp: any) => {
            this.tryPushValue(map, dp.id, dp.value);
        });
        node.children.forEach((child: any) => {
            this.calcChildData(child);
        });
        if (node.data.length > 0 && node.children.length > 0) {
            const directNode = {
                uid: node.data[0].uberon_id,
                name: node.name + ' (direct)',
                childData: null,
                parents: [],
                children: [],
                data: [],
                size: 1,
                value: Math.max(...node.data.map((r: any) => r.value))
            };
            node.children.push(directNode);
        }
        node.childData = map;
        node.size = map.size;
        node.value = Math.max(...Array.from(map.values()));
        return map;
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
