
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
     disid: Int!
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
     top: Int
     skip: Int
     filter: Filter
     count: Int
     facets (select: [String], exclude: [String]): [Facet]
     targets: [Target]
}

union SearchResult = Target | Disease | Ortholog | PubMed

type Result {
     targets: [Target]
     diseases: [Disease]
     pubs: [PubMed]
     orthologs: [Ortholog]
}

type Query {
     targets(skip: Int=0, top: Int=10, filter: IFilter): TargetResult
     target(q: TargetInput): Target

     diseases(skip: Int = 0, top: Int = 10, filter: IFilter): [Disease]

     pubCount(term: String = ""): Int
     pubmed(pmid: Int!): PubMed
     pubs(skip: Int=0, top: Int=10, term: String=""): [PubMed]

     orthologCounts: [IntProp]
     orthologs(skip: Int=0, top: Int=10, filter: IFilter): [Ortholog]

     search(skip: Int=0, top: Int=10, term: String!): Result
     xref(source: String!, value: String!): Xref
}
`;


const resolvers = {
    SearchResult: {
        __resolveType(obj, context, info) {
            //console.log('++++++ resolving '+obj);
            if (obj.targets)
                return 'TargetResult';
            if (obj.tcrd)
                return 'Target';
            if (obj.disid)
                return 'Disease';
            if (obj.orid)
                return 'Ortholog';
            if (obj.pmid)
                return 'PubMed';
            return null;
        }
    },
    
    Query: {
        search: async (_, args, {dataSources}) => {
            args.filter = {
                term: args.term
            };
            let t = dataSources.tcrd.searchTargets(args);
            let d = dataSources.tcrd.getDiseases(args);
            let p = dataSources.tcrd.getPubs(args);
            let o = dataSources.tcrd.getOrthologs(args);

            return Promise.all([t, d, p, o]).then(r => {
                let result = {};
                
                let hits = [];
                for (var i in r[0])
                    hits.push(r[0][i]);
                result.targets = hits;

                hits = [];
                for (var i in r[1])
                    hits.push(r[1][i]);
                result.diseases = hits;

                hits = [];
                for (var i in r[2])
                    hits.push(r[2][i]);
                result.pubs = hits;

                hits = [];
                for (var i in r[3])
                    hits.push(r[3][i]);
                result.orthologs = hits;

                return result;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        target: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getTarget(args.q);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        targets: async (_, args, {dataSources}) => {
            let counts = [
                dataSources.tcrd.getTargetTDLCounts(args),
                dataSources.tcrd.getTargetUniProtKeywordCounts(args)
            ];
            return Promise.all(counts).then(rows => {
                let facets = [];
                facets.push({
                    facet: 'tdl',
                    values: rows[0]
                });
                let count = 0;
                rows[0].forEach(x => {
                    count += x.value;
                });
                
                facets.push({
                    facet: 'UniProt Keyword',
                    values: rows[1]
                });

                return {
                    top: args.top,
                    skip: args.skip,
                    filter: args.filter,
                    count: count,
                    facets: facets,
                    targets: dataSources.tcrd.getTargets(args)
                        .then(targets => {
                            return targets;
                        }).catch(function(error) {
                            console.error(error);
                        })
                };
            }).catch(function(error) {
                console.error(error);
            });
        },

        diseases: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getDiseases(args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        xref: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getXref(args);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function(error) {
                console.error(error);
            });            
        },

        pubmed: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getPub(args.pmid);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        pubs: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getPubs(args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        pubCount: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getPubCount(args);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function(error) {
                console.error(error);
            });
        },

        orthologCounts: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getOrthologCounts();
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        orthologs: async (_, args, {dataSources}) => {
            const q = dataSources.tcrd.getOrthologs(args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },
    
    Target: {
        xrefs: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getXrefsForTarget(target);
            return q.then(rows => {
                if (args.source !== "")
                    return filter (rows, {source: args.source});
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        props: async (target, args, {dataSources}) => {
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

        synonyms: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getSynonymsForTarget(target);
            return q.then(rows => {
                if (args.name !== "")
                    return filter (rows, {name: args.name});
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        pubCount: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPubCountForTarget(target);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function(error) {
                console.error(error);
            });
        },
        
        pubs: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPubsForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        generifCount: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getGeneRIFCount(target);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function(error) {
                console.error(error);
            });
        },

        generifs: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getGeneRIFs(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        ppiCounts: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPPICountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        ppis: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPPIsForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        diseaseCounts: async (target, _, {dataSources}) => {
            const q = dataSources.tcrd.getDiseaseCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        diseases: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getDiseasesForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        patentCounts: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPatentCounts(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        patentScores: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPatentScores(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        pubmedScores: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPubMedScores(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        pantherPaths: async (target, args, {dataSources}) => {
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

        pantherClasses: async (target, _, {dataSources}) => {
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

        pathwayCounts: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPathwayCounts(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        pathways: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getPathways(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        locsigs: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getLocSigsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        lincsCounts: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getLINCSCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        lincs: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getLINCSForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        kegg: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getKeggDistancesForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        expressionCounts: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getExpressionCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        expressions: async (target, args, {dataSources}) => {
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

        orthologCounts: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getOrthologCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        orthologs: async (target, args, {dataSources}) => {
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

        gwasCounts: async (target, args, {dataSources}) => {
            const q = dataSources.tcrd.getGWASCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },
        gwas: async (target, args, {dataSources}) => {
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
        targetCounts: async (pubmed, args, {dataSources}) => {
            const q = dataSources.tcrd.getTargetCountsForPubMed(pubmed);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        targets: async (pubmed, args, {dataSources}) => {
            const q = dataSources.tcrd.getTargetsForPubMed(pubmed, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },
    
    Xref: {
        targets: async (xref, args, {dataSources}) => {
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
        pubs: async (generif, args, {dataSources}) => {
            const q = dataSources.tcrd.getPubsForGeneRIF(generif);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    TargetNeighbor: {
        props: async (neighbor, args, {dataSources}) => {
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

        target: async (neighbor, args, {dataSources}) => {
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
        targetCounts: async (disease, _, {dataSources}) => {
            const q = dataSources.tcrd.getTargetCountsForDisease(disease);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        targets: async (disease, args, {dataSources}) => {
            const q = dataSources.tcrd.getTargetsForDisease(disease, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    Pathway: {
        targetCounts: async (pathway, _, {dataSources}) => {
            const q = dataSources.tcrd.getTargetCountsForPathway(pathway);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        },

        targets: async (pathway, args, {dataSources}) => {
            const q = dataSources.tcrd.getTargetsForPathway(pathway, args);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    LocSig: {
        pubs: async (locsig, args, {dataSources}) => {
            const q = dataSources.tcrd.getPubsForLocSig(locsig);
            return q.then(rows => {
                return rows;
            }).catch(function(error) {
                console.error(error);
            });
        }
    },

    Expression: {
        uberon: async (expr, args, {dataSources}) => {
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
        pub: async (expr, args, {dataSources}) => {
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
        diseases: async (ortho, args, {dataSources}) => {
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
        diseases: async (ortho, args, {dataSources}) => {
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
        values: async (facet, args, _) => {
            if (args.name)
                return filter (facet.values, {name: args.name});
            return slice (facet.values, args.skip, args.top + args.skip);
        }
    },

    TargetResult: {
        facets: async (result, args, _) => {
            if (args.select) {
                return filter (result.facets, f => 
                               find (args.select, x => x == f.facet));
            }
            if (args.exclude) {
                return filter (result.facets, f =>
                               find (args.exclude, x => x !== f.facet));
            }
            return result.facets;
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
