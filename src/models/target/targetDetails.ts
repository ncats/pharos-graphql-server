import {DatabaseConfig} from "../databaseConfig";
import {FieldInfo} from "../FieldInfo";
import {ListContext} from "../listManager";
import {HierarchicalQuery} from "../hierarchicalQuery";
import {PythonCalculation} from "../externalAPI/PythonCalculation";

const abstractCountString = '__ABSTRACT_COUNT__';

export class TargetDetails {
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

    getPublicationCount() {
        const query = this.knex('protein2pubmed')
            .countDistinct({count: 'pubmed_id'})
            .where('protein_id', this.target.protein_id)
            .andWhere('source', 'NCBI');
        return query.then((res: any[]) => {
            if (res && res.length > 0) {
                return res[0].count;
            }
            return 0;
        })
    }

    getPublications() {
        const that = this;
        const query = this.knex({pubmed: 'ncats_pubmed.pubmed', pp: 'protein2pubmed'})
            .select({
                pmid: 'pubmed.id',
                gene_id: this.knex.raw('group_concat(pp.gene_id)'),
                title: `title`,
                journal: `journal`,
                date: `date`,
                authors: `authors`,
                abstract: `abstract`,
                fetch_date: `fetch_date`
            })
            .where('pp.pubmed_id', this.knex.raw('pubmed.id'))
            .andWhere('pp.protein_id', this.target.protein_id)
            .andWhere('pp.source', 'NCBI')
            .orderBy('pubmed.date', 'desc')
            .groupBy('pubmed.id')
            .limit(this.top).offset(this.skip);
        return query.then((res: any[]) => {
            res.forEach((row: any) => {
                if (row.gene_id && row.gene_id.length > 0) {
                    row.gene_id = row.gene_id.split(',');
                }
            });
            return res;
        });
    }

    getGenerifsForTargetPub(pubObj: any) {
        const query = this.knex({generif: 'generif', generif2pubmed: 'generif2pubmed'})
            .select({
                rifid: 'generif.id',
                gene_id: this.knex.raw('group_concat(generif.gene_id)'),
                text: 'generif.text',
                date: 'generif.date'
            })
            .where('generif.id', this.knex.raw('generif2pubmed.generif_id'))
            .andWhere('protein_id', this.target.protein_id)
            .andWhere('pubmed_id', pubObj.pmid)
            .groupBy('generif.text')
        return query.then((res: any[]) => {
            res.forEach((row: any) => {
                if (row.gene_id && row.gene_id.length > 0) {
                    row.gene_id = row.gene_id.split(',');
                }
            });
            return res;
        });
    }

    private getWordRegex() {
        const wordPattern = /\b[A-Za-z]+[A-Za-z0-9\-\./\+]{1,}\b|\b[0-9]+[A-Za-z]+[0-9]+\b/;
        return new RegExp(wordPattern, 'gm');
    };

    private getAbstractQuery(columns: string[] | any, limit: number | null = null) {
        const abstractQuery = this.knex({pubmed: 'ncats_pubmed.pubmed', pp: 'protein2pubmed'})
            .distinct(columns)
            .where('pp.pubmed_id', this.knex.raw('pubmed.id'))
            .andWhere('pp.protein_id', this.target.protein_id)
            .andWhere('source', 'NCBI')
            .whereNotNull('abstract');
        if (limit) {
            abstractQuery.orderBy('pubmed_id', 'desc').limit(limit);
        }
        return abstractQuery;
    }

    getAbstractWordCounts() {
        const re = this.getWordRegex();
        const abstractQuery = this.getAbstractQuery(['pubmed_id', 'abstract'], 100);

        return abstractQuery.then((abstractRows: any[]) => {
            const articleSetWordCount = new Map<string, number>();
            const wordFormDictionary = new Map<string, { text: string, count: number }[]>();

            abstractRows.forEach((articleRow: any) => {
                const wordMatches = articleRow.abstract.match(re);
                const articleWordList = new Map<string, number>();
                wordMatches.forEach((actualWord: string) => {
                    const lowercaseWord = actualWord.toLowerCase();
                    articleWordList.set(lowercaseWord, 1);
                    const wordFormList = wordFormDictionary.get(lowercaseWord) || [];
                    wordFormDictionary.set(lowercaseWord, wordFormList);

                    const existingMatch = wordFormList.find((m: any) => m.text === actualWord);
                    if (existingMatch) {
                        existingMatch.count++;
                    } else {
                        wordFormList.push({text: actualWord, count: 1});
                    }
                });
                articleWordList.forEach((v, k) => {
                    const count = articleSetWordCount.get(k) || 0;
                    articleSetWordCount.set(k, count + 1);
                });
            });

            var items = Array.from(articleSetWordCount.keys()).map(word => {
                return {name: word, count: articleSetWordCount.get(word) || 0};
            });

            if (abstractRows.length > 20) {
                items = items.filter(r => r.count >= 2);
            }

            const wordQuery = this.knex('word_count').select('*')
                .whereIn('word', [abstractCountString, ...items.map(a => a.name)]);

            return wordQuery.then((fullCounts: { word: string, count: number }[]) => {
                const fullCountDict = new Map<string, number>();
                fullCounts.forEach(row => {
                    fullCountDict.set(row.word, row.count);
                });

                const totalAbstractCount = fullCountDict.get(abstractCountString);
                const contingencyTables: any[] = [];
                const wordCounts: { name: string, count: number, oddsRatio: number, pValue: number }[] = [];
                let count = 0;
                items.forEach(wordCountPair => {
                    const wordFormList = wordFormDictionary.get(wordCountPair.name) || [];
                    const name = wordFormList.sort((a: any, b: any) => b.count - a.count)[0].text;

                    const inListHasValue = wordCountPair.count;
                    const inListNoValue = abstractRows.length - inListHasValue;
                    const fullListHasValue = fullCountDict.get(wordCountPair.name);
                    // @ts-ignore
                    const fullListNoValue = totalAbstractCount - fullListHasValue;
                    // @ts-ignore
                    const outListHasValue = fullListHasValue - inListHasValue;
                    const outListNoValue = fullListNoValue - inListNoValue;
                    let oddsRatio = (inListHasValue * outListNoValue) / (inListNoValue * outListHasValue);
                    if (isFinite(oddsRatio) && oddsRatio > 0) {
                        count += 1;
                        wordCounts.push({name: name, count: inListHasValue, oddsRatio: oddsRatio, pValue: 0});
                        contingencyTables.push([[inListHasValue, outListHasValue], [inListNoValue, outListNoValue]]);
                    }
                });

                const pyCalc = new PythonCalculation();
                return pyCalc.calculateFisherTest(contingencyTables).then((fisherResults: any[]) => {
                    wordCounts.forEach((wc, index) => {
                        wc.pValue = -Math.log(fisherResults[index][1]);
                    });
                    return wordCounts.sort((a, b) => b.pValue - a.pValue).slice(0, this.top);
                });
            });
        });
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
        const hQ = new HierarchicalQuery(this.knex);
        return hQ.getExpressionHierarchy(this.target.protein_id);
    }

    getDiseaseTree() {
        const hQ = new HierarchicalQuery(this.knex);
        return hQ.getDiseaseHierarchy(this.target.protein_id);
    }

    getTinxTree() {
        const hQ = new HierarchicalQuery(this.knex);
        return hQ.getTinxHierarchy(this.target.protein_id);
    }

    getFacetValueCount() {
        const query = this.databaseConfig.getBaseSetQuery('protein', this.facet,
            {value: this.knex.raw(`count(distinct ${this.facet.select})`)})
            .where('protein.uniprot', this.target.uniprot);
        return query;
    }

    getAllFacetValues() {
        const query = this.databaseConfig.getBaseSetQuery('protein', this.facet)
            .where('protein.uniprot', this.target.uniprot)
            .orderBy('value')
            .limit(this.top)
            .offset(this.skip);
        return query;
    }

    getSequenceVariants() {
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
            name: `sequence_annotation.name`
        })
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

    static LD2JSON(ldObject: any) {
        const jsonObject: any = {};
        for (const prop in ldObject) {
            if (ldObject[prop]['@value']) {
                jsonObject[prop] = ldObject[prop]['@value'];
            } else if (ldObject[prop]['rdfs:label']) {
                jsonObject[prop] = ldObject[prop]['rdfs:label'];
            }
        }
        return jsonObject;
    }
}
