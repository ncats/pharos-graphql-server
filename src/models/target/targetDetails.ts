import {DatabaseConfig} from "../databaseConfig";
import {FieldInfo} from "../FieldInfo";
import {ListContext} from "../listManager";
import {HierarchicalQuery} from "../hierarchicalQuery";

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
                fetch_date:`fetch_date`
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

    getAbstractWordCounts() {
        const query = this.knex({pubmed: 'ncats_pubmed.pubmed', pp: 'protein2pubmed'})
            .distinct(['pubmed_id', 'abstract'])
            .where('pp.pubmed_id', this.knex.raw('pubmed.id'))
            .andWhere('pp.protein_id', this.target.protein_id)
            .andWhere('source', 'NCBI')
            .whereNotNull('abstract')
            .orderBy('pubmed_id', 'desc')
            .limit(50);
        return query.then((res: any[]) => {
            const wordDict = new Map<string, any >();
            const wordPattern = /\b[A-Za-z]+[A-Za-z0-9\-\./]{1,}\b|\b[0-9]+[A-Za-z]+[0-9]+\b/
            const re = new RegExp(wordPattern, 'gm');
            res.forEach((articleObj: any) => {
                const matches = articleObj.abstract.match(re);
                matches.forEach((word: string) => {
                    const keyWord = word.toUpperCase();
                    if (!this.stopWords.includes(keyWord)) {
                        const countObject = wordDict.get(keyWord) || {count: 0, matches: []};
                        wordDict.set(keyWord, countObject);
                        countObject.count++;

                        const existingMatch = countObject.matches.find((m: any) => m.text === word);
                        if (existingMatch) {
                            existingMatch.count ++;
                        } else {
                            countObject.matches.push({text: word, count: 1});
                        }
                    }
                });
            });

            var items = Array.from(wordDict.values()).sort((a, b) => b.count - a.count );
            const wordCounts: {name: string, value: number}[] = [];

            let count = 0;
            items.every(item => {
                const value = item.count;
                const name = item.matches.sort((a: any, b: any) => b.count - a.count)[0].text;
                wordCounts.push({name: name, value: value});
                count ++;
                if (count >= this.top) {return false;}
                return true;
            });
            return wordCounts;
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

    stopWords = [
        "HOWEVER",
        "ABOUT",
        "ABOVE",
        "AFTER",
        "AGAIN",
        "AGAINST",
        "ALL",
        "AM",
        "AN",
        "AND",
        "ANY",
        "ARE",
        "AREN",
        "AS",
        "AT",
        "BE",
        "BECAUSE",
        "BEEN",
        "BEFORE",
        "BEING",
        "BELOW",
        "BETWEEN",
        "BOTH",
        "BUT",
        "BY",
        "CAN",
        "CANNOT",
        "COULD",
        "COULDN",
        "DID",
        "DIDN",
        "DO",
        "DOES",
        "DOESN",
        "DOING",
        "DON",
        "DOWN",
        "DURING",
        "EACH",
        "FEW",
        "FOR",
        "FROM",
        "FURTHER",
        "HAD",
        "HADN",
        "HAS",
        "HASN",
        "HAVE",
        "HAVEN",
        "HAVING",
        "HE",
        "LL",
        "HER",
        "HERE",
        "HERS",
        "HERSELF",
        "HIM",
        "HIMSELF",
        "HIS",
        "HOW",
        "VE",
        "IF",
        "IN",
        "INTO",
        "IS",
        "ISN",
        "IT",
        "ITS",
        "ITSELF",
        "LET",
        "ME",
        "MORE",
        "MOST",
        "MUSTN",
        "MY",
        "MYSELF",
        "NO",
        "NOR",
        "NOT",
        "OF",
        "OFF",
        "ON",
        "ONCE",
        "ONLY",
        "OR",
        "OTHER",
        "OUGHT",
        "OUR",
        "OURS",
        "OURSELVES",
        "OUT",
        "OVER",
        "OWN",
        "SAME",
        "SHAN",
        "SHE",
        "SHOULD",
        "SHOULDN",
        "SO",
        "SOME",
        "SUCH",
        "THAN",
        "THAT",
        "THE",
        "THEIR",
        "THEIRS",
        "THEM",
        "THEMSELVES",
        "THEN",
        "THERE",
        "THESE",
        "THEY",
        "THIS",
        "THOSE",
        "THROUGH",
        "TO",
        "TOO",
        "UNDER",
        "UNTIL",
        "UP",
        "VERY",
        "WAS",
        "WASN",
        "WE",
        "WERE",
        "WEREN",
        "WHAT",
        "WHEN",
        "WHERE",
        "WHICH",
        "WHILE",
        "WHO",
        "WHOM",
        "WHY",
        "WITH",
        "WON",
        "WOULD",
        "WOULDN",
        "YOU",
        "YOUR",
        "YOURS",
        "YOURSELF",
        "YOURSELVES"];
}
