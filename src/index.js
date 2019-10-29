
const express = require('express');
//const { ApolloServer, gql } = require('apollo-server');
const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('graphql-tools');
const { find, filter, slice } = require('lodash');

const TCRD = require('./TCRD');

const typeDefs = `

type Xref {
     source: String!
     value: String!
     targets(tdl: String = "", fam: String = ""): [Target]
}

type Prop {
     name: String!
     value: String!
}

type IntProp {
     name: String!
     value: Int!
}

type FloatProp {
     name: String!
     value: Float!
}

type TemporalCount {
     year: Int!
     count: Int!
}

type TemporalScore {
     year: Int!
     score: Float!
}

type Facet {
     facet: String!
     values (skip: Int=0, top: Int=10, name: String): [IntProp]
}

input IFilterFacet {
     facet: String!
     values: [String]
}

type FilterFacet {
     facet: String!
     values: [String]
}

"""Input IRangeFloat: [start, end)"""
input IRangeInt {
     name: String!
     start: Int
     end: Int
}

"""Input IRangeFloat: [start, end) when start & end are specified;
if start is not specified, then < end. Otherwise if end is not specified,
then the range >= start is assumed."""
input IRangeFloat {
     name: String!
     start: Float
     end: Float
}

input IFilter {
     term: String
     facets: [IFilterFacet]
     irange: [IRangeInt]
     frange: [IRangeFloat]
     order: String
}

type Filter {
     term: String
     facets: [FilterFacet]
}

type PantherPath {
     pcid: String!
     name: String!
     parents: [PantherPath]
}

type PantherClass {
     pcid: String!
     name: String!
     parents: [String]
}

type Pathway {
     pwid: Int!
     type: String!
     name: String!
     targetCounts: [IntProp]
     targets(skip: Int=0, top: Int=10, filter: IFilter): [Target]
}

input TargetInput {
     tcrdid: Int
     uniprot: String
     geneid: Int
     sym: String
     stringid: String
}

type PubMed {
     pmid: String!
     title: String
     journal: String
     date: String
     abstract: String
     targetCounts: [IntProp]
     targets(skip: Int=0, top: Int=10, filter: IFilter): [Target]
}

type GeneRIF {
     rifid: Int!
     text: String
     target: Target!
     pubs: [PubMed]
}

"""Ortholog"""
type Ortholog {
     orid: Int!
     species: String!
     sym: String
     name: String!
     dbid: String
     geneid: Int
     source: [String]
     diseases: [OrthologDisease]
}

type OrthologDisease {
     ordid: Int!
     score: Float!
     diseases: [Disease]
}

"""Disease entity"""
type Disease {
     name: String!
     associationCount: Int!
     associations (skip: Int=0, top: Int=10): [DiseaseAssociation]
}

type DiseaseAssociation {
     disassid: Int!
     type: String!
     name: String!
     did: String
     description: String
     zscore: Float
     evidence: String
     conf: Float
     reference: String
     drug: String
     log2foldchange: Float
     pvalue: Float
     score: Float
     source: String

     targetCounts: [IntProp]
     targets (skip: Int=0, top: Int=10, filter: IFilter): [Target]
}

"""Target relationships such as PPI"""
type TargetNeighbor {
     nid: Int!
     type: String!
     props: [Prop]
     target: Target!
}

"""LocSigDB: database of protein localization signals"""
type LocSig {
     locid: Int!
     location: String!
     signal: String!
     pubs: [PubMed]
}

"""LINCS: Library of Integrated Network-Based Cellular Signatures"""
type LINCS {
     lncsid: Int!
     cellid: String!
     zscore: Float
     smiles: String
     targets (skip: Int=0, top: Int=10, filter: IFilter): [Target]
}

type Uberon {
     uid: String!
     name: String!
     def: String
     comment: String
}

"""Expression entity"""
type Expression {
     expid: Int!
     type: String!
     tissue: String!
"""quality value: enum('Not detected','Low','Medium','High')"""
     qual: String
     value: String
     evidence: String
     zscore: Float
     conf: Float
"""BrendaTissue ontology"""
     btoid: String
     cellid: String
     uberon: Uberon
     pub: PubMed
}

"""GWAS catalog data"""
type GWAS {
     gwasid: Int!
     trait: String!
     snps: [Prop]
     pvalue: Float
     pub: PubMed
}

"""Ligand"""
type Ligand {
     ligid: String!
     name: String
     isdrug: Boolean
     synonyms: [Prop]
     smiles: String
     props: [Prop]
     activities(skip: Int=0, top: Int=10, filter: IFilter): [LigandActivity]
}

type LigandActivity {
     actid: Int!
     type: String
     value: Float
     ligand: Ligand
     pub: PubMed
}

"""Target entity"""
type Target {
"""Internal TCRD ID; should not be used externally!"""
     tcrdid: Int!
"""UniProt Accession"""
     uniprot: String!
"""Target name"""
     name: String!
"""Gene symbol"""
     sym: String
"""Summary of gene/protein"""
     description: String
"""Target development leve"""
     tdl: String
"""Target family"""
     fam: String
     seq: String!
"""Target novelty score"""
     novelty: Float

"""Properties and cross references"""
     props(name: String = ""): [Prop]
     synonyms(name: String = ""): [Prop]
     xrefs(source: String = ""): [Xref]

"""Publications associated with this protein"""
     pubCount: Int
     pubs(skip: Int = 0, top: Int = 10, term: String = ""): [PubMed]

"""GeneRIF information"""
     generifCount: Int
     generifs(skip: Int = 0, top: Int = 10, term: String=""): [GeneRIF]

"""Protein-protein interaction"""
     ppiCounts: [IntProp]
     ppis(skip: Int = 0, top: Int = 10, filter: IFilter): [TargetNeighbor]

"""Disease associations"""
     diseaseCounts: [IntProp]
     diseases(skip: Int=0, top: Int=10, type: [String]=[]): [Disease]

"""Patent information"""
     patentCounts: [TemporalCount]
     patentScores: [TemporalScore]
     pubmedScores: [TemporalScore]

"""Panther protein ontology"""
     pantherPaths: [PantherPath]
     pantherClasses: [PantherClass]

"""Pathway information"""
     pathwayCounts: [IntProp]
     pathways(skip: Int=0, top: Int=10, type: [String]=[]): [Pathway]

"""Protein signal localization"""
     locsigs: [LocSig]

"""LINCS: Library of Integrated Network-Based Cellular Signatures"""
     lincs (skip: Int=0, top: Int=10, cellid: [String]=[]): [LINCS]
     lincsCounts: [IntProp]

"""Target neighbors expressed as distance in KEGG pathway"""
     kegg(skip: Int=0, top: Int=10, filter: IFilter): [TargetNeighbor]

"""Tissue expression"""
     expressionCounts: [IntProp]
     expressions(skip: Int=0, top: Int=10, filter: IFilter): [Expression]

"""Ortholog protein"""
     orthologCounts: [IntProp]
     orthologs(skip: Int=0, top: Int=10, filter: IFilter): [Ortholog]

"""GWAS catalog"""
     gwasCounts: [IntProp]
     gwas(skip: Int=0, top: Int=10, filter: IFilter): [GWAS]
}

type TargetResult {
     filter: Filter
     count: Int
     facets (include: [String], exclude: [String]): [Facet]
     targets(skip: Int=0, top: Int=10): [Target]
}

type DiseaseResult {
     filter: Filter
     count: Int
     facets (include: [String], exclude: [String]): [Facet]
     diseases(skip: Int=0, top: Int=10): [Disease]
}

type PubResult {
     filter: Filter
     count: Int
     facets (include: [String], exclude: [String]): [Facet]
     pubs(skip: Int=0, top: Int=10): [PubMed]
}

type OrthologResult {
     filter: Filter
     count: Int
     facets (include: [String], exclude: [String]): [Facet]
     orthologs(skip: Int=0, top: Int=10): [Ortholog]
}

type Result {
     targetResult: TargetResult
     diseaseResult: DiseaseResult
     pubResult: PubResult
     orthologResult: OrthologResult
}

type Query {
     targetFacets: [String!]
     targets(skip: Int=0, top: Int=10, 
             facets: [String!], filter: IFilter): TargetResult
     target(q: TargetInput): Target

     diseases(skip: Int = 0, top: Int = 10, filter: IFilter): DiseaseResult

     pubCount(term: String = ""): Int
     pubmed(pmid: Int!): PubMed
     pubs(skip: Int=0, top: Int=10, term: String!): PubResult

     orthologCounts: [IntProp]
     orthologs(skip: Int=0, top: Int=10, filter: IFilter): OrthologResult

     search(term: String!, facets: [String!]): Result
     xref(source: String!, value: String!): Xref
}
`;

function getTargetFacets (args, tcrd, all) {
    const TARGET_FACETS = [
        ['Target Development Level', tcrd.getTargetTDLCounts(args)],
        ['tdl', tcrd.getTargetTDLCounts(args)],        
        ['UniProt Keyword', tcrd.getTargetUniProtKeywordCounts(args)],
        ['Keyword', tcrd.getTargetUniProtKeywordCounts(args)],
        ['Family', tcrd.getTargetFamilyCounts(args)],
        ['fam', tcrd.getTargetFamilyCounts(args)],
        ['Indication',
         tcrd.getTargetDiseaseCounts(args, 'DrugCentral Indication')],
        ['Monarch Disease', tcrd.getTargetDiseaseCounts(args, 'Monarch')],
        ['UniProt Disease',
         tcrd.getTargetDiseaseCounts(args, 'UniProt Disease')],
        ['Ortholog', tcrd.getTargetOrthologCounts(args)],
        ['IMPC Phenotype', tcrd.getTargetIMPCPhenotypeCounts(args)],
        ['JAX/MGI Phenotype', tcrd.getTargetMGIPhenotypeCounts(args)],
        ['GO Process', tcrd.getTargetGOCounts(args, 'P')],
        ['GO Component', tcrd.getTargetGOCounts(args, 'C')],
        ['GO Function', tcrd.getTargetGOCounts(args, 'F')],
        ['GWAS', tcrd.getTargetGWASCounts(args)],
        ['Expression: CCLE', tcrd.getTargetExpressionCounts(args, 'CCLE')],
        ['Expression: HCA RNA',
         tcrd.getTargetExpressionCounts(args, 'HCA RNA')],
        ['Expression: HPM Protein',
         tcrd.getTargetExpressionCounts(args, 'HPM Protein')],
        ['Expression: HPA', tcrd.getTargetExpressionCounts(args, 'HPA')],
        ['Expression: JensenLab Experiment HPA',
         tcrd.getTargetExpressionCounts(args, 'JensenLab Experiment HPA')],
        ['Expression: HPM Gene',
         tcrd.getTargetExpressionCounts(args, 'HPM Gene')],
        ['Expression: JensenLab Experiment HPA-RNA',
         tcrd.getTargetExpressionCounts(args, 'JensenLab Experiment HPA-RNA')],
        ['Expression: JensenLab Experiment GNF',
         tcrd.getTargetExpressionCounts(args, 'JensenLab Experiment GNF')],
        ['Expression: Consensus',
         tcrd.getTargetExpressionCounts(args, 'Consensus')],
        ['Expression: JensenLab Experiment Exon array',
         tcrd.getTargetExpressionCounts
         (args, 'JensenLab Experiment Exon array')],
        ['Expression: JensenLab Experiment RNA-seq',
         tcrd.getTargetExpressionCounts(args, 'JensenLab Experiment RNA-seq')],
        ['Expression: JensenLab Experiment UniGene',
         tcrd.getTargetExpressionCounts(args, 'JensenLab Experiment UniGene')],
        ['Expression: UniProt Tissue',
         tcrd.getTargetExpressionCounts(args, 'UniProt Tissue')],
        ['Expression: JensenLab Knowledge UniProtKB-RC',
         tcrd.getTargetExpressionCounts
         (args, 'JensenLab Knowledge UniProtKB-RC')],
        ['Expression: JensenLab Text Mining',
         tcrd.getTargetExpressionCounts(args, 'JensenLab Text Mining')],
        ['Expression: JensenLab Experiment Cardiac proteome',
         tcrd.getTargetExpressionCounts
         (args, 'JensenLab Experiment Cardiac proteome')],
        ['Expression: Cell Surface Protein Atlas',
         tcrd.getTargetExpressionCounts(args, 'Cell Surface Protein Atlas')]
    ];

    let facets = new Map (TARGET_FACETS);
    if (args.facets) {
        let subset = new Map ();
        facets.forEach((value, key) => {
            if (find (args.facets, x => {
                var matched = x == key;
                if (!matched) {
                    var re = new RegExp(x);
                    matched = re.test(key);
                    //console.log('**** '+x+ ' ~ '+key+' => '+matched);
                }
                return matched;
            })) {
                subset.set(key, value);
            }
        });
        
        // make sure facets specified in filter are also included
        if (args.filter && args.filter.facets) {
            for (var i in args.filter.facets) {
                var f = args.filter.facets[i];
                subset.set(f.facet, facets.get(f.facet));
            }
        }
        facets = subset;
    }
    else if (!all) {
        const deffacets = [
            'Target Development Level',
            'Family',
            'IMPC Phenotype',
            'GWAS',
            'Expression: Consensus',
            'Ortholog',
            'UniProt Disease'
        ];
        let subset = new Map ();
        deffacets.forEach(x => {
            subset.set(x, facets.get(x));
        });
        facets = subset;
    }
    
    return facets;
}

function getTargetResult (args, tcrd) {
    const facets = getTargetFacets (args, tcrd);
    const fkeys = Array.from(facets.keys());
    
    //console.log('!!!! targetResult: args='+JSON.stringify(args)+' keys='+fkeys);
    return Promise.all(Array.from(facets.values())).then(rows => {
        let count = 0;
        rows[0].forEach(x => {
            count += x.value;
        });
        
        let facets = [];
        for (var i in rows) {
            facets.push({
                facet: fkeys[i],
                values: rows[i]
            });
        }
        
        return {
            filter: args.filter,
            count: count,
            facets: facets,
        };
    });
}

function getDiseaseResult (args, tcrd) {
    let counts = [
        tcrd.getDiseaseDataSourceCounts(args),
        tcrd.getDiseaseDrugCounts(args),
        tcrd.getDiseaseTDLCounts(args)
    ];
    return Promise.all(counts).then(rows => {
        let facets = [];
        facets.push({
            facet: 'Data Source',
            values: rows[0]
        });
        let count = 0;
        rows[0].forEach(x => {
            count += x.value;
        });
        
        facets.push({
            facet: 'Drug',
            values: rows[1]
        });
        facets.push({
            facet: 'Target Development Level',
            values: rows[2]
        });
        
        return {
            filter: args.filter,
            count: count,
            facets: facets
        };
    });
}

function getPubResult (args, tcrd) {
    let counts = [
        tcrd.getPubTDLCounts(args)
    ];
    return Promise.all(counts).then(rows => {
        let facets = [];
        facets.push({
            facet: 'Target Development Level',
            values: rows[0]
        });
        
        return {
            filter: args.filter,
            count: tcrd.getPubCount(args)
                .then(rows => {
                    if (rows) return rows[0].cnt;
                    return 0;
                }),
            facets: facets
        };
    });
}

function getOrthologResult (args, tcrd) {
    let counts = [
        tcrd.getOrthologSpeciesCounts(args),
        tcrd.getOrthologTDLCounts(args)
    ];
    return Promise.all(counts).then(rows => {
        let facets = [];
        facets.push({
            facet: 'Species',
            values: rows[0]
        });
        let count = 0;
        rows[0].forEach(x => {
            count += x.value;
        });

        facets.push({
            facet: 'Target Development Level',
            values: rows[1]
        });
        
        return {
            filter: args.filter,
            count: count,
            facets: facets
        };
    });
}

function filterResultFacets (result, args) {
    let facets = result.facets;
    if (args.include) {
        facets = filter (facets, f => 
                         find (args.include, x => {
                             var matched = x == f.facet;
                             if (!matched) {
                                 var re = new RegExp(x);
                                 matched = re.test(f.facet);
                             }
                             return matched;
                         }));
    }
    
    if (args.exclude) {
        facets = filter (facets, f =>
                         find (args.exclude, x => {
                             var matched = x == f.facet;
                             if (!matched) {
                                 var re = new RegExp(x);
                                 matched = re.test(f.facet);
                             }
                             return !matched;
                         }));
    }
    return facets;
}

const resolvers = {
    Query: {
        search: async function (_, args, {dataSources}) {
            args.filter = {
                term: args.term
            };

            let t = getTargetResult(args, dataSources.tcrd);
            let d = getDiseaseResult(args, dataSources.tcrd);
            let p = getPubResult(args, dataSources.tcrd);
            let o = getOrthologResult(args, dataSources.tcrd);

            return Promise.all([t, d, p, o]).then(r => {
                return {
                    targetResult: r[0],
                    diseaseResult: r[1],
                    pubResult: r[2],
                    orthologResult: r[3]
                };
            }).catch(function(error) {
                console.error(error);
            });
        },

        targetFacets: async function (_, args, {dataSources}) {
            return getTargetFacets(args, dataSources.tcrd, true).keys();
        },
        
        target: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getTarget(args.q);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        targets: async function (_, args, {dataSources}) {
            return getTargetResult (args, dataSources.tcrd);
        },

        diseases: async function (_, args, {dataSources}) {
            return getDiseaseResult (args, dataSources.tcrd);
        },
        
        xref: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getXref(args);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function(error) {
                console.error(error);
            });            
        },

        pubmed: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getPub(args.pmid);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        pubs: async function (_, args, {dataSources}) {
            args.filter = {
                term: args.term
            };
            return getPubResult (args, dataSources.tcrd);
        },
        pubCount: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getPubCount(args);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function(error) {
                console.error(error);
            });
        },

        orthologCounts: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getOrthologCounts();
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        orthologs: async function (_, args, {dataSources}) {
            return getOrthologResult (args, dataSources.tcrd);
        }
    },
    
    Target: {
        xrefs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getXrefsForTarget(target);
            return q.then(rows => {
                if (args.source !== "")
                    return filter (rows, {source: args.source});
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        props: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPropsForTarget(target);
            return q.then(rows => {
                if (args.name !== "" && args.name !== "*") {
                    rows = filter (rows, {itype: args.name});
                }
                return rows.map(r => {
                    //console.log(r);
                    if (r.number_value != null)
                        return {'name': r.itype,
                                'value': r.number_value.toString()};
                    else if (r.integer_value != null)
                        return {'name': r.itype,
                                'value': r.integer_value.toString()};
                    else if (r.boolean_value != null)
                        return {'name': r.itype,
                                'value': r.boolean_value.toString()};
                    else if (r.date_value != null)
                        return {'name': r.itype,
                                'value': r.date_value.toString()};
                    return {'name': r.itype,
                            'value': r.string_value};
                });
            }).catch(function(error) {
                console.error(error);
            });
        },

        synonyms: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getSynonymsForTarget(target);
            return q.then(rows => {
                if (args.name !== "") {
                    return filter (rows, x => {
                        var matched = x.name == args.name;
                        if (!matched) {
                            var re = new RegExp (args.name);
                            matched = re.test(x.name);
                        }
                        return matched;
                    });
                }
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        pubCount: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPubCountForTarget(target);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        pubs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPubsForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        generifCount: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getGeneRIFCount(target);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function(error) {
                console.error(error);
            });
        },

        generifs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getGeneRIFs(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        ppiCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPPICountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        ppis: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPPIsForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        diseaseCounts: async function (target, _, {dataSources}) {
            const q = dataSources.tcrd.getDiseaseCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        diseases: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getDiseasesForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        patentCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPatentCounts(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        patentScores: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPatentScores(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        pubmedScores: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPubMedScores(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        pantherPaths: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPanther(target);
            return q.then(rows => {
                let classes = {};
                let children = {};
                for (var i in rows) {
                    let r = rows[i];
                    let toks = r.parent_pcids.split('|');
                    let p = {'pcid':r.pcid,
                             'name':r.name,
                             'parents': []};
                    let unique = {};
                    for (var j in toks) {
                        if (unique[toks[j]] == undefined
                            && toks[j] !== 'PC00000') {
                            p.parents.push(toks[j]);
                            children[toks[j]] = r.pcid;
                        }
                        unique[toks[j]] = 1;
                    }
                    classes[r.pcid] = p;
                }

                let panthers = [];
                for (var i in classes) {
                    let p = classes[i];
                    let parents = p.parents;
                    p.parents = [];
                    for (var j in parents) {
                        p.parents.push(classes[parents[j]]);
                    }
                    if (children[i] == undefined)
                        panthers.push(p);
                }
                return panthers;
            }).catch(function(error) {
                console.error(error);
            });
        },

        pantherClasses: async function (target, _, {dataSources}) {
            const q = dataSources.tcrd.getPanther(target);
            return q.then(rows => {
                let classes = [];
                for (var i in rows) {
                    let r = rows[i];
                    let toks = r.parent_pcids.split('|');
                    let p = {'pcid':r.pcid,
                             'name':r.name,
                             'parents': []};
                    let unique = {};
                    for (var j in toks) {
                        if (unique[toks[j]] == undefined
                            && toks[j] !== 'PC00000') {
                            p.parents.push(toks[j]);
                        }
                        unique[toks[j]] = 1;
                    }
                    classes.push(p);
                }
                return classes;
            }).catch(function(error) {
                console.error(error);
            });
        },

        pathwayCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPathwayCounts(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        pathways: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPathways(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        locsigs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getLocSigsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        lincsCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getLINCSCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        lincs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getLINCSForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        kegg: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getKeggDistancesForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        expressionCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getExpressionCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        expressions: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getExpressionsForTarget(target, args);
            return q.then(rows => {
                return rows.map(x => {
                    if (x.number_value)
                        x.value = x.number_value;
                    else if (x.boolean_value)
                        x.value = x.boolean_value;
                    else if (x.string_value)
                        x.value = x.string_value;
                    return x;
                });
            }).catch(function(error) {
                console.error(error);
            });
        },

        orthologCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getOrthologCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        orthologs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getOrthologsForTarget(target, args);
            return q.then(rows => {
                return rows.map(x => {
                    if (x.sources) {
                        x.source = x.sources.split(',').map(z => z.trim());
                    }
                    return x;
                });
            }).catch(function(error) {
                console.error(error);
            });
        },

        gwasCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getGWASCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        gwas: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getGWASForTarget(target, args);
            return q.then(rows => {
                rows.forEach(x => {
                    let snps = x._snps.split(';');
                    let ctx = x.context.split(';');
                    if (snps.length == ctx.length) {
                        let data = [];
                        for (var i in snps) {
                            data.push({name: ctx[i], value:snps[i]});
                        }
                        x.snps = data;
                    }
                    else {
                        console.error(x.gwasid+': invalid parallel '
                                      +'arrays in gwas snp!');
                    }
                });
                
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    PubMed: {
        targetCounts: async function (pubmed, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetCountsForPubMed(pubmed);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        targets: async function (pubmed, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetsForPubMed(pubmed, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },
    
    Xref: {
        targets: async function (xref, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetsForXref(xref);
            return q.then(rows => {
                if (args.tdl !== "" && args.fam !== "") 
                    return filter (rows, {tdl: args.tdl, fam: args.fam});
                else if (args.tdl !== "")
                    return filter (rows, {tdl: args.tdl});
                else if (args.fam !== "")
                    return filter (rows, {fam: args.fam});
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    GeneRIF: {
        pubs: async function (generif, args, {dataSources}) {
            const q = dataSources.tcrd.getPubsForGeneRIF(generif);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    TargetNeighbor: {
        props: async function (neighbor, args, {dataSources}) {
            let props = [
                {'name': 'tdl', 'value': neighbor.tdl}
            ];

            if (neighbor.novelty)
                props.push({'name': 'novelty', 'value': neighbor.novelty});
            if (neighbor.fam)
                props.push({'name': 'fam', 'value': neighbor.fam});

            if (neighbor.type == 'KEGG') {
                props.push({'name': 'distance', 'value': neighbor.distance});
            }
            else {
                // else assume it's ppi
                if (neighbor.p_int) {
                    props.push({'name': 'p_int',
                                'value': neighbor.p_int});
                }
                if (neighbor.p_ni) {
                    props.push({'name': 'p_ni', 'value': neighbor.p_ni});
                }
                if (neighbor.p_wrong) {
                    props.push({'name': 'p_wrong',
                                'value': neighbor.p_wrong});
                }
                if (neighbor.evidence) {
                    props.push({'name': 'evidence',
                                'value': neighbor.evidence});
                }
                if (neighbor.score) {
                    props.push({'name': 'score', 'value': neighbor.score});
                }
            }
            return props;
        },

        target: async function (neighbor, args, {dataSources}) {
            let q;
            if (neighbor.type == 'KEGG') {
                q = dataSources.tcrd.getTargetForKeggNeighbor(neighbor);
            }
            else {
                q = dataSources.tcrd.getTargetForPPINeighbor(neighbor);
            }
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    Disease: {
        associations: async function (disease, args, {dataSources}) {
            args.filter = disease.filter;
            const q = dataSources.tcrd
                  .getDiseaseAssociationsForDisease(disease, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },
    
    DiseaseAssociation: {
        targetCounts: async function (disease, _, {dataSources}) {
            const q = dataSources.tcrd
                  .getTargetCountsForDiseaseAssociation(disease);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        targets: async function (disease, args, {dataSources}) {
            const q = dataSources.tcrd
                  .getTargetsForDiseaseAssociation(disease, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    Pathway: {
        targetCounts: async function (pathway, _, {dataSources}) {
            const q = dataSources.tcrd.getTargetCountsForPathway(pathway);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        targets: async function (pathway, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetsForPathway(pathway, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    LocSig: {
        pubs: async function (locsig, args, {dataSources}) {
            const q = dataSources.tcrd.getPubsForLocSig(locsig);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    Expression: {
        uberon: async function (expr, args, {dataSources}) {
            if (expr.uberon_id) {
                return {
                    uid: expr.uberon_id,
                    name: expr.name,
                    def: expr.def,
                    comment: expr.comment
                };
            }
            return null;
        },
        pub: async function (expr, args, {dataSources}) {
            if (expr.pubmed_id) {
                return dataSources.tcrd.getPub(expr.pubmed_id)
                    .then(rows => {
                        if (rows) return rows[0];
                        return rows;
                    }).catch(function(error) {
                        console.error(error);
                    });
            }
            return null;
        }
    },

    Ortholog: {
        diseases: async function (ortho, args, {dataSources}) {
            const q = dataSources.tcrd
                  .getOrthologDiseasesForOrtholog(ortho, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    OrthologDisease: {
        diseases: async function (ortho, args, {dataSources}) {
            const q = dataSources.tcrd
                  .getDiseasesForOrthologDisease(ortho, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    Facet: {
        values: async function (facet, args, _) {
            let values = facet.values;
            if (args.name) {
                values = filter (values, x => {
                    var matched = x.name == args.name;
                    if (!matched) {
                        var re = new RegExp(args.name);
                        matched = re.test(x.name);
                    }
                    return matched;
                });
            }
            return slice (values, args.skip, args.top + args.skip);
        }
    },

    TargetResult: {
        facets: async (result, args, _) => filterResultFacets (result, args),
        targets: async function (result, args, {dataSources}) {
            args.filter = result.filter;
            return dataSources.tcrd.getTargets(args)
                .then(targets => {
                    return targets;
                }).catch(function(error) {
                    console.error(error);
                });            
        }
    },

    DiseaseResult: {
        facets: async (result, args, _) => filterResultFacets (result, args),
        diseases: async function (result, args, {dataSources}) {
            args.filter = result.filter;
            return dataSources.tcrd.getDiseases(args)
                .then(diseases => {
                    diseases.forEach(x => {
                        x.filter = result.filter;
                    });
                    return diseases;
                }).catch(function(error) {
                    console.error(error);
                });
        }
    },

    PubResult: {
        facets: async (result, args, _) => filterResultFacets (result, args),
        pubs: async function (result, args, {dataSources}) {
            args.term = result.filter.term;
            return dataSources.tcrd.getPubs(args)
                .then(pubs => {
                    return pubs;
                }).catch(function(error) {
                    console.error(error);
                });
        }
    },

    OrthologResult: {
        facets: async (result, args, _) => filterResultFacets (result, args),
        orthologs: async function (result, args, {dataSources}) {
            args.term = result.filter.term;
            return dataSources.tcrd.getOrthologs(args)
                .then(orthologs => {
                    return orthologs;
                }).catch(function(error) {
                    console.error(error);
                });
        }
    }
};

const schema = makeExecutableSchema({
    typeDefs,
    resolvers
});

const tcrdConfig = {
    client: 'mysql',
    connection: {
        host: 'tcrd.kmc.io',
        user: 'tcrd',
        password: '',
        database: 'tcrd600'
    },
    pool: {
        min: 2,
        max: 10,
        createTimeoutMillis: 3000,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
        propagateCreateError: false // <- default is true, set to false
    }
};

const tcrd = new TCRD(tcrdConfig);
const server = new ApolloServer({
    schema: schema,
    introspection: true,
    playground: true,
    dataSources: () => ({
        tcrd: tcrd
    })
});

// Initialize the app
const app = express();

server.applyMiddleware({
    app,
    path: '/graphql'
});

const PORT = process.env.PORT || 4000;
app.listen({port: PORT}, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
});
