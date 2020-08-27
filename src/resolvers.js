const {FacetDataType} = require("./models/FacetInfo");
const {LigandList} = require("./models/ligand/ligandList");
const {DiseaseList} = require("./models/disease/diseaseList");
const {TargetList} = require("./models/target/targetList");
const {Virus} = require("./models/virus/virusQuery");
const {performance} = require('perf_hooks');
const {find, filter, slice} = require('lodash');

const resolvers = {
    Query: {
        autocomplete: async function (_, args, {dataSources}) {
            let results = dataSources.tcrd.getSuggestions(args.name);
            let startTime = performance.now();

            return Promise.all([results]).then(rows => {
                var sorted = {};
                sorted["UniProt Gene"] = [];
                sorted["Target"] = [];
                sorted["Disease"] = [];
                sorted["IMPC Phenotype"] = [];
                sorted["UniProt Keyword"] = [];

                for (var i = 0; i < rows[0].length; i++) {
                    sorted[rows[0][i].source].push({key: rows[0][i].value});
                }
                return {
                    elapsedTime: (performance.now() - startTime) / 1000,
                    genes: sorted["UniProt Gene"],
                    targets: sorted["Target"],
                    diseases: sorted["Disease"],
                    phenotypes: sorted["IMPC Phenotype"],
                    keywords: sorted["UniProt Keyword"]
                };
            }).catch(function (error) {
                console.error(error);
            });
        },

        search: async function (_, args, {dataSources}) {
            args.filter = {
                term: args.term
            };

            let t = getTargetResult(args, dataSources);
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
            }).catch(function (error) {
                console.error(error);
            });
        },

        targetFacets: async function (_, args, {dataSources}) {
            return TargetList.AllFacets();
        },

        target: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getTarget(args.q);
            return q.then(rows => {
                if (rows) {
                    if(rows.length > 0){
                        dataSources.associatedTargetTCRDID = rows[0].id;
                    }
                    return rows[0];}
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        targets: async function (_, args, {dataSources}) {
            return getTargetResult(args, dataSources);
        },

        disease: async function (_, args, {dataSources}) {
            return dataSources.tcrd.getDisease(args.name)
                .then(rows => {
                    rows = filter(rows, r => r.name != null && r.associationCount > 0);
                    if (rows.length > 0) {
                        rows[0].name = args.name;
                        return rows[0];
                    }
                    return {name: args.name, associationCount: 0};
                }).catch(function (error) {
                    console.error(error);
                });
        },
        diseases: async function (_, args, {dataSources}) {
            return getDiseaseResult(args, dataSources.tcrd);
        },

        ligand: async function (_, args, {dataSources}) {
            return Promise.all([
                dataSources.tcrd.getDrug(args.ligid),
                dataSources.tcrd.getLigand(args.ligid)
            ]).then(rows => {
                let lig = null;
                if (rows[0]) {
                    rows[0].forEach(r => {
                        if (!lig)
                            lig = toLigand(r);
                        else
                            toLigand(r, lig);
                    });

                    if (lig) {
                        lig.actcnt = rows[0].length;
                    }
                }
                if (rows[1]) {
                    rows[1].forEach(r => {
                        if (!lig) lig = toLigand(r);
                        else toLigand(r, lig);
                    });
                    if (lig) {
                        lig.actcnt += rows[1].length;
                    }
                }
                return lig;
            }).catch(function (error) {
                console.error(error);
            });
        },
        ligands: async function (_, args, {dataSources}) {
            return getLigandResult(args, dataSources.tcrd);
        },

        xref: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getXref(args);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        pubmed: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getPub(args.pmid);
            return q.then(rows => {
                if (rows) {
                    let p = rows[0];
                    p.year = parseInt(p.date);
                    return p;
                }
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        pubs: async function (_, args, {dataSources}) {
            args.filter = {
                term: args.term
            };
            return getPubResult(args, dataSources.tcrd);
        },
        pubCount: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getPubCount(args);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function (error) {
                console.error(error);
            });
        },

        orthologCounts: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getOrthologCounts();
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        orthologs: async function (_, args, {dataSources}) {
            return getOrthologResult(args, dataSources.tcrd);
        },

        batch: async function (line, args, {dataSources}, info) {
            let funcs = [
                getTargetResult(args, dataSources),
                getDiseaseResult(args, dataSources.tcrd),
                getLigandResult(args, dataSources.tcrd)
            ];
            return Promise.all(funcs).then(r => {
                return {
                    targetResult: r[0],
                    diseaseResult: r[1],
                    ligandResult: r[2] // sigh
                };
            }).catch(function (error) {
                console.error(error);
            });
        },

        doTree: async function (_, args, {dataSources}) {
            let nodes = [];
            let doTree = dataSources.tcrd.doTree;
            for (var key in doTree) {
                let node = doTree[key];
                // only return the root nodes
                if (node.parents.length == 0)
                    nodes.push(node);
            }
            return nodes;
        },
        diseaseOntology: async function (_, args, {dataSources}) {
            return dataSources.tcrd.getDiseaseOntology(args);
        },

        dto: async function (_, args, {dataSources}) {
            let nodes = [];
            let dto = dataSources.tcrd.dto;
            for (var key in dto) {
                let n = dto[key];
                if (!n.parent)
                    nodes.push(n);
            }
            return nodes;
        },
        dtoNode: async function (_, args, {dataSources}) {
            return dataSources.tcrd.getDTO(args);
        }
    },

    Target: {
        interactingViruses: async function (target, args, {dataSources}) {
            let query = Virus.getQuery(dataSources.tcrd.db, target.tcrdid);
            return query.then(rows => {
                return Virus.parseResult(rows);
            });
        },

        dto: async function (target, args, {dataSources}) {
            return dataSources.tcrd.getDTO(target);
        },

        xrefs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getXrefsForTarget(target);
            return q.then(rows => {
                if (args.source !== "")
                    return filter(rows, {source: args.source});
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        props: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPropsForTarget(target);
            return q.then(rows => {
                if (args.name !== "" && args.name !== "*") {
                    rows = filter(rows, {itype: args.name});
                }
                return rows.map(r => {
                    //console.log(r);
                    if (r.number_value != null)
                        return {
                            'name': r.itype,
                            'value': r.number_value.toString()
                        };
                    else if (r.integer_value != null)
                        return {
                            'name': r.itype,
                            'value': r.integer_value.toString()
                        };
                    else if (r.boolean_value != null)
                        return {
                            'name': r.itype,
                            'value': r.boolean_value.toString()
                        };
                    else if (r.date_value != null)
                        return {
                            'name': r.itype,
                            'value': r.date_value.toString()
                        };
                    return {
                        'name': r.itype,
                        'value': r.string_value
                    };
                });
            }).catch(function (error) {
                console.error(error);
            });
        },

        synonyms: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getSynonymsForTarget(target);
            return q.then(rows => {
                if (args.name !== "") {
                    return filter(rows, x => {
                        var matched = x.name == args.name;
                        if (!matched) {
                            var re = new RegExp(args.name, 'i');
                            matched = re.test(x.name);
                        }
                        return matched;
                    });
                }
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        pubCount: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPubCountForTarget(target);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function (error) {
                console.error(error);
            });
        },

        pubs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPubsForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        generifCount: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getGeneRIFCount(target);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function (error) {
                console.error(error);
            });
        },

        generifs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getGeneRIFs(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        ppiCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPPICountsForTarget(target, args);
            return q.then(rows => {
                let returnArray = [];
                let total = 0;
                for (let i = 0; i < rows.length; i++) {
                    let sources = rows[i].name;
                    let value = rows[i].value;
                    total += value;
                    let sourceArray = sources.split(',');
                    for (let j = 0; j < sourceArray.length; j++) {
                        let ix = returnArray.findIndex(rr => rr.name == sourceArray[j]);
                        if (ix >= 0) {
                            returnArray[ix].value += value;
                        } else {
                            returnArray.push({name: sourceArray[j], value: value});
                        }
                    }
                }
                returnArray.push({name: "Total", value: total});
                return returnArray;
            }).catch(function (error) {
                console.error(error);
            });
        },

        ppis: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPPIsForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        ppiTargetInteractionDetails: async function (target, args, {dataSources}) {
            if (!dataSources.associatedTarget) {
                return null;
            }
            if (dataSources.listResults && dataSources.listResults.length > 0) {
                theRow = dataSources.listResults.find(rowData => {
                    return rowData.tcrdid == target.tcrdid;
                });
                if (theRow) {
                    theRow.score = theRow.score / 1000;
                    return theRow;
                }
            }
            const q = dataSources.tcrd.db.select(
                dataSources.tcrd.db.raw(
                    `ppitypes, p_int, p_ni, p_wrong, evidence, interaction_type, score/1000
            FROM ncats_ppi, t2tc
            WHERE
            t2tc.target_id = ?
            AND (ncats_ppi.protein_id = t2tc.protein_id
            AND ncats_ppi.other_id = (select id from protein where match(uniprot,sym,stringid) against(? in boolean mode)))`,
                    [target.tcrdid, dataSources.associatedTarget]));
            return q.then(rows => {
                return rows[0];
            });
        },
        diseaseAssociationDetails: async function (target, args, {dataSources}) {
            if (!dataSources.associatedDisease) {
                return null;
            }
            const q = DiseaseList.getAssociationDetails(dataSources.tcrd.db, dataSources.associatedDisease, target.tcrdid);
            return q.then(rows => {
                return rows;
            });
        },
        diseaseCounts: async function (target, args, {dataSources}) {
            let diseaseArgs = args;
            diseaseArgs.filter = diseaseArgs.filter || {};
            diseaseArgs.filter.associatedTarget = target.uniprot;
            let diseaseList = new DiseaseList(dataSources.tcrd, diseaseArgs);
            const q = diseaseList.getAssociatedTargetQuery();
            return q.then(rows => {
                rows.forEach(x => {
                    x.value = x.associationCount;
                });
                return rows;
            });
        },

        diseases: async function (target, args, {dataSources}) {
            let diseaseArgs = args;
            diseaseArgs.filter = diseaseArgs.filter || {};
            diseaseArgs.filter.associatedTarget = target.uniprot;
            let diseaseList = new DiseaseList(dataSources.tcrd, diseaseArgs);
            const q = diseaseList.getAssociatedTargetQuery();
            if (args.top) {
                q.limit(args.top);
            }
            if (args.skip) {
                q.offset(args.skip);
            }
            return q.then(rows => {
                let diseases = filter(rows, r => r.name != null
                    && r.associationCount > 0);
                diseases.forEach(x => x.parent = target);
                return diseases;
            }).catch(function (error) {
                console.error(error);
            });
        },

        patentCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPatentCounts(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        pubTatorScores: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPubTatorScores(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        pubmedScores: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPubMedScores(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
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
                    let p = {
                        'pcid': r.pcid,
                        'name': r.name,
                        'parents': []
                    };
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
            }).catch(function (error) {
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
                    let p = {
                        'pcid': r.pcid,
                        'name': r.name,
                        'parents': []
                    };
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
            }).catch(function (error) {
                console.error(error);
            });
        },

        pathwayCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPathwayCounts(target);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        pathways: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getPathways(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        locsigs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getLocSigsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        lincsCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getLINCSCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        lincs: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getLINCSForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        kegg: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getKeggDistancesForTarget(target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        expressionCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getExpressionCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
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
            }).catch(function (error) {
                console.error(error);
            });
        },

        orthologCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getOrthologCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
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
            }).catch(function (error) {
                console.error(error);
            });
        },

        gwasCounts: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.getGWASCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
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
                            data.push({name: ctx[i], value: snps[i]});
                        }
                        x.snps = data;
                    } else {
                        console.error(x.gwasid + ': invalid parallel '
                            + 'arrays in gwas snp!');
                    }
                });

                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        goCounts: async function (target, _, {dataSources}) {
            return dataSources.tcrd.getGOCountsForTarget(target)
                .then(rows => {
                    return rows;
                }).catch(function (error) {
                    console.error(error);
                });
        },
        go: async function (target, args, {dataSources}) {
            return dataSources.tcrd.getGOTermsForTarget(target, args)
                .then(rows => {
                    return rows;
                }).catch(function (error) {
                    console.error(error);
                });
        },

        mimCount: async function (target, _, {dataSources}) {
            const q = dataSources.tcrd.getMIMCountForTarget(target);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function (error) {
                console.error(error);
            });
        },
        mim: async function (target, args, {dataSources}) {
            return dataSources.tcrd.getMIMForTarget(target, args)
                .then(rows => {
                    return rows;
                }).catch(function (error) {
                    console.error(error);
                });
        },

        harmonizome: async function (target, args, {dataSources}) {
            return {target: target};
        },

        ligandCounts: async function (target, args, {dataSources}) {
            let ligandArgs = args;
            ligandArgs.filter = ligandArgs.filter || {};
            ligandArgs.filter.associatedTarget = target.uniprot;
            let ligandList = new LigandList(dataSources.tcrd, ligandArgs);
            ligandList.facetsToFetch = [ligandList.facetFactory.GetFacet(ligandList, "Type")];
            return ligandList.getFacetQueries()[0]
                .then(results => {
                    return [{
                        name: "ligand",
                        value: getCount(results, "Ligand")
                    }, {
                        name: "drug",
                        value: getCount(results, "Drug")
                    }];
                }).catch(function (error) {
                    console.error(error);
                });

            function getCount(results, rowName) {
                let row = results.find(row => row.name === rowName);
                if (row) return row.value;
                return 0;
            }
        },

        ligands: async function (target, args, {dataSources}) {
            let ligandArgs = args;
            ligandArgs.filter = ligandArgs.filter || {};
            ligandArgs.filter.associatedTarget = target.uniprot;
            ligandArgs.filter.facets = ligandArgs.filter.facets || [];
            if (ligandArgs.isdrug) {
                ligandArgs.filter.facets.push({facet: "Type", values: ["Drug"]});
            }
            else {
                ligandArgs.filter.facets.push({facet: "Type", values: ["Ligand"]});
            }
            return new LigandList(dataSources.tcrd, ligandArgs).getListQuery()
                .then(allResults => {
                    return allResults;
                })
                .catch(function (error) {
                    console.error(error);
                });
        },

        tinxCount: async function (target, args, {dataSources}) {
            return dataSources.tcrd.getTINXCountForTarget(target)
                .then(rows => {
                    if (rows) return rows[0].cnt;
                    return 0;
                }).catch(function (error) {
                    console.error(error);
                });
        },
        tinx: async function (target, args, {dataSources}) {
            return dataSources.tcrd.getTINXForTarget(target, args)
                .then(rows => {
                    return rows;
                }).catch(function (error) {
                    console.error(error);
                });
        }
    },

    PubMed: {
        targetCounts: async function (pubmed, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetCountsForPubMed(pubmed);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        targets: async function (pubmed, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetsForPubMed(pubmed, args);
            return q.then(rows => {
                rows.forEach(x => {
                    x.parent = pubmed;
                });
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    Xref: {
        targets: async function (xref, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetsForXref(xref);
            return q.then(rows => {
                if (args.tdl !== "" && args.fam !== "")
                    return filter(rows, {tdl: args.tdl, fam: args.fam});
                else if (args.tdl !== "")
                    return filter(rows, {tdl: args.tdl});
                else if (args.fam !== "")
                    return filter(rows, {fam: args.fam});
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    GeneRIF: {
        pubs: async function (generif, args, {dataSources}) {
            const q = dataSources.tcrd.getPubsForGeneRIF(generif);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
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
                props.push({'name': 'Novelty', 'value': neighbor.novelty});
            if (neighbor.fam)
                props.push({'name': 'fam', 'value': neighbor.fam});

            if (neighbor.type == 'KEGG') {
                props.push({'name': 'distance', 'value': neighbor.distance});
            } else {
                // else assume it's ppi
                if (neighbor.p_int) {
                    props.push({
                        'name': 'p_int',
                        'value': neighbor.p_int
                    });
                }
                if (neighbor.p_ni) {
                    props.push({'name': 'p_ni', 'value': neighbor.p_ni});
                }
                if (neighbor.p_wrong) {
                    props.push({
                        'name': 'p_wrong',
                        'value': neighbor.p_wrong
                    });
                }
                if (neighbor.evidence) {
                    props.push({
                        'name': 'Evidence',
                        'value': neighbor.evidence
                    });
                }
                if (neighbor.score) {
                    props.push({'name': 'Score', 'value': neighbor.score / 1000});
                }
                if (neighbor.ppiTypes) {
                    props.push({'name': 'Data Source', 'value': neighbor.ppiTypes});
                }
            }
            return props;
        },

        target: async function (neighbor, args, {dataSources}) {
            let q;
            if (neighbor.type == 'KEGG') {
                q = dataSources.tcrd.getTargetForKeggNeighbor(neighbor);
            } else {
                q = dataSources.tcrd.getTargetForPPINeighbor(neighbor);
            }
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    Disease: {
        associations: async function (disease, args, {dataSources}) {
            //console.log('~~~~ disease "'+disease.name+'" (parent) = '+disease.parent);
            args.filter = disease.filter;
            const q = dataSources.tcrd
                .getDiseaseAssociationsForDisease(disease, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        uniprotDescription: async function (disease, args, {dataSources}) {
            const q = dataSources.tcrd.db('disease')
                .select('description')
                .whereRaw(`ncats_name = "${disease.name}" and dtype = "UniProt Disease"`)
                .limit(1);
            return q.then(rows => {
                if (rows.length) {
                    return rows[0].description;
                }
                return '';
            }).catch(function (error) {
                console.error(error);
            });
        },
        doDescription: async function (disease, args, {dataSources}) {
            const q = dataSources.tcrd.db({disease: 'disease', do: 'do'})
                .select({description: 'do.def'})
                .whereRaw(`ncats_name = "${disease.name}" and do.doid = disease.did`)
                .limit(1);
            return q.then(rows => {
                if (rows.length) {
                    return rows[0].description;
                }
                return '';
            }).catch(function (error) {
                console.error(error);
            });
        },
        dids: async function (disease, args, {dataSources}) {
            const q = dataSources.tcrd.db('disease')
                .select({
                    dataSources: dataSources.tcrd.db.raw(`group_concat(distinct dtype)`),
                    id: 'did',
                    doName: 'do.name',
                    doDefinition: 'do.def'
                })
                .leftJoin('do', 'disease.did', 'do.doid')
                .whereRaw(`disease.ncats_name = "${disease.name}"`)
                .whereNotNull('disease.did')
                .groupBy('did');
            return q.then(rows => {
                for (let i = 0; i < rows.length; i++) {
                    rows[i].dataSources = rows[i].dataSources.split(',');
                }
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        targetCounts: async function (disease, _, {dataSources}) {
            let targetArgs = {};
            targetArgs.filter = {};
            targetArgs.filter.associatedDisease = disease.name;
            targetArgs.facets = ["Target Development Level"];
            let targetList = new TargetList(dataSources.tcrd, targetArgs);
            return targetList.getFacetQueries()[0]
                .then(rows => {
                    return rows;
                }).catch(function (error) {
                    console.error(error);
                });
        },
        targets: async function (disease, args, {dataSources}) {
            let targetArgs = args || {};
            targetArgs.filter = targetArgs.filter || {};
            targetArgs.filter.associatedDisease = disease.name;
            let targetList = new TargetList(dataSources.tcrd, targetArgs);
            return targetList.getListQuery().then(rows => {
                rows.forEach(x => {
                    x.parent = disease;
                });
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        parents: async function (disease, args, {dataSources}) {
            let query = dataSources.tcrd.db({do_child: 'do', relationship: 'do_parent', do_par: 'do'})
                .select(dataSources.tcrd.db.raw(`do_par.name, count(distinct protein_id) as 'associationCount'`))
                .leftJoin('disease', 'disease.ncats_name', 'do_par.name')
                .whereRaw(`do_child.name = "${disease.name}"`)
                .whereRaw('do_child.doid = relationship.doid')
                .whereRaw('do_par.doid = relationship.parent_id')
                .groupBy('name')
                .orderBy('associationCount', 'desc');
            return query.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        children: async function (disease, args, {dataSources}) {
            let query = dataSources.tcrd.db({do_par: 'do', relationship: 'do_parent', do_child: 'do'})
                .select(dataSources.tcrd.db.raw(`do_child.name, count(distinct protein_id) as 'associationCount'`))
                .leftJoin('disease', 'disease.ncats_name', 'do_child.name')
                .whereRaw(`do_par.name = "${disease.name}"`)
                .whereRaw('do_child.doid = relationship.doid')
                .whereRaw('do_par.doid = relationship.parent_id')
                .groupBy('name')
                .orderBy('associationCount', 'desc');
            return query.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        tinx: async function (disease, args, {dataSources}){
            let query = DiseaseList.getTinxQuery(dataSources.tcrd.db, disease.name);
            return query.then(rows => {
                let associationMap = new Map();
                for(let i = 0 ; i < rows.length ; i++){
                    if(associationMap.has(rows[i].targetID)){
                        let details = associationMap.get(rows[i].targetID).details;
                        details.push({doid: rows[i].doid, diseaseName: rows[i].name, importance: rows[i].importance});
                    }
                    else{
                        let association = {};
                        association.targetID = rows[i].targetID;
                        association.targetName = rows[i].targetName;
                        association.novelty = rows[i].novelty;
                        association.tdl = rows[i].tdl;
                        association.details = [];
                        association.details.push({doid: rows[i].doid, diseaseName: rows[i].name, importance: rows[i].importance});
                        associationMap.set(rows[i].targetID, association);
                    }
                }
                return associationMap.values();
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    DiseaseAssociation: {
        targetCounts: async function (disease, _, {dataSources}) { // TODO: this really doesn't belong here, it recalculates the same thing for all the associations, I left a stub so that it doesn't break with the client, please delete it, oh great and powerful future developer
            return resolvers.Disease.targetCounts(disease, _, {dataSources})
                .then(rows => {
                    return rows;
                })
                .catch(function (error) {
                    console.error(error);
                });
        },
        targets: async function (disease, args, {dataSources}) { // TODO: this too
            return resolvers.Disease.targets(disease, args, {dataSources})
                .then(rows => {
                    return rows;
                })
                .catch(function (error) {
                    console.error(error);
                });
        }
    },

    Pathway: {
        targetCounts: async function (pathway, _, {dataSources}) {
            const q = dataSources.tcrd.getTargetCountsForPathway(pathway);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        targets: async function (pathway, args, {dataSources}) {
            const q = dataSources.tcrd.getTargetsForPathway(pathway, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    LocSig: {
        pubs: async function (locsig, args, {dataSources}) {
            const q = dataSources.tcrd.getPubsForLocSig(locsig);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
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
                    }).catch(function (error) {
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
            }).catch(function (error) {
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
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    Facet: {
        values: async function (facet, args, _) {
            let values = facet.values;
            if (args.name) {
                values = filter(values, x => {
                    var matched = x.name == args.name;
                    if (!matched) {
                        var re = new RegExp(args.name, 'i');
                        matched = re.test(x.name);
                    }
                    return matched;
                });
            }
            if(facet.dataType == "Numeric"){
                return values;
            }
            return slice(values, args.skip, args.top + args.skip);
        }
    },

    TargetResult: {
        facets: async (result, args, _) => filterResultFacets(result, args),
        targets: async function (result, args, {dataSources}) {
            args.filter = result.filter;
            args.batch = result.batch;
            let q = new TargetList(dataSources.tcrd, args).getListQuery();
            //console.log(q.toString());
            return q.then(targets => {
                dataSources.listResults = targets;
                return targets;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    DiseaseResult: {
        facets: async (result, args, _) => filterResultFacets(result, args),
        diseases: async function (result, args, {dataSources}) {
            args.filter = result.filter;
            return new DiseaseList(dataSources.tcrd, args).getListQuery()
                .then(diseases => {
                    diseases.forEach(x => {
                        x.filter = result.filter;
                        x.associationCount = x.count;
                    });
                    return diseases;
                }).catch(function (error) {
                    console.error(error);
                });
        }
    },

    LigandResult: {
        facets: async (result, args, _) => filterResultFacets(result, args),
        ligands: async function (result, args, {dataSources}) {
            args.filter = result.filter;
            let ligandList = new LigandList(dataSources.tcrd, args);
            return ligandList.getListQuery().then(
                ligands => {
                    return ligands;
                }
            ).catch(function (error) {
                console.error(error);
            });
        }
    },

    PubResult: {
        facets: async (result, args, _) => filterResultFacets(result, args),
        pubs: async function (result, args, {dataSources}) {
            if (result.filter)
                args.term = result.filter.term;
            return dataSources.tcrd.getPubs(args)
                .then(pubs => {
                    pubs.forEach(p => {
                        p.year = parseInt(p.date);
                    });
                    return pubs;
                }).catch(function (error) {
                    console.error(error);
                });
        }
    },

    OrthologResult: {
        facets: async (result, args, _) => filterResultFacets(result, args),
        orthologs: async function (result, args, {dataSources}) {
            if (result.filter)
                args.term = result.filter.term;
            return dataSources.tcrd.getOrthologs(args)
                .then(orthologs => {
                    return orthologs;
                }).catch(function (error) {
                    console.error(error);
                });
        }
    },

    Harmonizome: {
        count: async function (hz, args, {dataSources}) {
            const q = dataSources.tcrd
                .getGeneAttributeCountForTarget(hz.target, args);
            return q.then(rows => {
                if (rows) return rows[0].cnt;
                return 0;
            }).catch(function (error) {
                console.error(error);
            });
        },

        attrs: async function (hz, args, {dataSources}) {
            const q = dataSources.tcrd
                .getGeneAttributesForTarget(hz.target, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        summary: async function (hz, args, {dataSources}) {
            const q = dataSources.tcrd
                .getGeneAttributeSummaryForTarget(hz.target, args);
            return q.then(rows => {
                let map;
                switch (args.which) {
                    case 'group':
                        map = dataSources.tcrd.gaGroups;
                        break;
                    case 'category':
                        map = dataSources.tcrd.gaCategories;
                        break;
                    default:
                        map = dataSources.tcrd.gaTypes;
                }

                let values = new Map();
                rows.forEach(r => {
                    values.set(r.name, r.value);
                });

                let stats = [];
                map.forEach(r => {
                    let v = values.get(r);
                    if (v) {
                    } else {
                        v = 0;
                    }
                    stats.push({name: r, value: v});
                });

                return stats;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    GeneAttribute: {
        gat: async function (ga, args, {dataSources}) {
            const q = dataSources.tcrd
                .getGeneAttributeTypeForGeneAttribute(ga, args);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    GeneAttributeType: {
        pubs: async function (gat, args, {dataSources}) {
            let q = dataSources.tcrd.getPubsForGeneAttributeType(gat, args);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        }
    },

    Ligand: {
        activities: async function (ligand, args, {dataSources}) {
            let query = dataSources.tcrd.db({
                ncats_ligand_activity: 'ncats_ligand_activity',
                ncats_ligands: 'ncats_ligands'
            })
                .select({
                    actid: 'ncats_ligand_activity.id',
                    type: 'act_type',
                    value: 'act_value',
                    moa: 'action_type',
                    target_id: 'target_id'
                })
                .whereRaw(`ncats_ligands.identifier = '${ligand.ligid}'`)
                .andWhere(dataSources.tcrd.db.raw(`ncats_ligand_activity.ncats_ligand_id = ncats_ligands.id`));
            if (dataSources.associatedTargetTCRDID) {
                query.andWhere(dataSources.tcrd.db.raw(`ncats_ligand_activity.target_id = ${dataSources.associatedTargetTCRDID}`));
            }
            return query.then(rows => {
                for (let i = 0; i < rows.length; i++) {
                    rows[i].parent = ligand;
                }
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        synonyms: async function (ligand, args, {dataSources}) {
            const parser = function(row){
                let synonyms = [];
                for (let field of ['PubChem', 'Guide to Pharmacology', 'ChEMBL', 'DrugCentral']) {
                    if (row[field]) {
                        synonyms.push({name: field, value: row[field]});
                    }
                }
                synonyms.push({name: "LyCHI", value: ligand.ligid});
                return synonyms;
            };

            let synonyms = [];
            if (!ligand['PubChem'] && !ligand['Guide to Pharmacology'] && !ligand['ChEMBL'] && !ligand['DrugCentral']) {
                let query = dataSources.tcrd.db('ncats_ligands')
                    .select(['PubChem', 'Guide to Pharmacology', 'ChEMBL', 'DrugCentral'])
                    .where('identifier', ligand.ligid);
                return query.then(rows => {
                    return parser(rows[0]);
                })
            }
            return parser(ligand);

        }
    },

    LigandActivity: {
        target: async function (ligact, args, {dataSources}) {
            return dataSources.tcrd.getTarget({tcrdid: ligact.target_id})
                .then(rows => {
                    return rows[0];
                }).catch(function (error) {
                    console.error(error);
                });
        }
    },

    TINXDisease: {
        disease: async function (tinx, _, {dataSources}) {
            //console.log('~~~~~ tinx: '+tinx.doid);
            if (tinx.doid)
                return dataSources.tcrd.doTree[tinx.doid];
            console.error('No doid in TINX ' + tinx.tinxid);
            return null;
        }
    }
};

function getTargetResult(args, dataSources) {
    //console.log(JSON.stringify(args));
    args.batch = args.targets;
    const targetList = new TargetList(dataSources.tcrd, args);
    dataSources.associatedTarget = targetList.associatedTarget;
    dataSources.associatedDisease = targetList.associatedDisease;
    const proteinListQuery = targetList.fetchProteinList();
    if (!!proteinListQuery) {
        return proteinListQuery.then(rows => {
            targetList.cacheProteinList(Array.from(rows, row => row.protein_id));
        }).then(() => {
            return doFacetQuery();
        });
    } else {
        return doFacetQuery();
    }

    function doFacetQuery() {
        const countQuery = targetList.getCountQuery();
        const facetQueries = targetList.getFacetQueries();
        facetQueries.unshift(countQuery);

        return Promise.all(Array.from(facetQueries.values())).then(rows => {
            let count = rows.shift()[0].count;
            facetQueries.shift();

            let facets = [];
            for (var i in rows) {
                let rowData = rows[i];
                if (targetList.facetsToFetch[i].valuesDelimited) {
                    rowData = splitOnDelimiters(rows[i]);
                }
                if (targetList.facetsToFetch[i].dataType == FacetDataType.numeric){
                    rowData = rowData.map(p => {p.name = p.bin; return p})
                }
                facets.push({
                    dataType: targetList.facetsToFetch[i].dataType == FacetDataType.numeric ? "Numeric" : "Category",
                    binSize: targetList.facetsToFetch[i].binSize,
                    facet: targetList.facetsToFetch[i].type,
                    count: rowData.length,
                    values: rowData,
                    sql: facetQueries[i].toString(),
                    elapsedTime: targetList.getElapsedTime(targetList.facetsToFetch[i].type)
                });
            }
            return {
                filter: args.filter,
                batch: args.targets,
                count: count,
                facets: facets
            };
        });
    }
}

function getDiseaseResult(args, tcrd) {
    let diseaseList = new DiseaseList(tcrd, args);
    let queries = diseaseList.getFacetQueries();
    queries.unshift(diseaseList.getCountQuery());

    return Promise.all(queries).then(rows => {
        let count = rows.shift()[0].count;

        let facets = [];
        for (var i in rows) {
            facets.push({
                facet: diseaseList.facetsToFetch[i].type,
                count: rows[i].length,
                values: rows[i]
            })
        }

        return {
            filter: args.filter,
            count: count,
            facets: facets
        };
    }).catch(function (error) {
        console.error(error);
    });
}

function splitOnDelimiters(rowData) {
    let returnArray = [];
    let total = 0;
    for (let i = 0; i < rowData.length; i++) {
        let sources = rowData[i].name;
        let value = rowData[i].value;
        total += value;
        let sourceArray = sources.split(',');
        for (let j = 0; j < sourceArray.length; j++) {
            let ix = returnArray.findIndex(rr => rr.name == sourceArray[j]);
            if (ix >= 0) {
                returnArray[ix].value += value;
            } else {
                returnArray.push({name: sourceArray[j], value: value});
            }
        }
    }
    return returnArray;
}

function getLigandResult(args, tcrd) {
    let ligandList = new LigandList(tcrd, args);
    const countQuery = ligandList.getCountQuery();
    const facetQueries = ligandList.getFacetQueries();
    facetQueries.unshift(countQuery);
    return Promise.all(Array.from(facetQueries.values())).then(rows => {
        let count = rows.shift()[0].count;
        let facets = [];
        for (var i in rows) {
            let rowData = splitOnDelimiters(rows[i]);
            facets.push({
                facet: ligandList.facetsToFetch[i].type,
                count: rowData.length,
                values: rowData,
                sql: facetQueries[i].toString(),
                elapsedTime: ligandList.getElapsedTime(ligandList.facetsToFetch[i].type)
            });
        }
        return {
            filter: args.filter,
            count: count,
            facets: facets
        };
    }).catch(function (error) {
        console.error(error);
    });
}

function getPubResult(args, tcrd) {
    let counts = [
        tcrd.getPubTDLCounts(args)
    ];
    return Promise.all(counts).then(rows => {
        let facets = [];
        facets.push({
            facet: 'Target Development Level',
            count: rows[0].length,
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

function getOrthologResult(args, tcrd) {
    let counts = [
        tcrd.getOrthologSpeciesCounts(args),
        tcrd.getOrthologTDLCounts(args)
    ];
    return Promise.all(counts).then(rows => {
        let facets = [];
        facets.push({
            facet: 'Species',
            count: rows[0].length,
            values: rows[0]
        });
        let count = 0;
        rows[0].forEach(x => {
            count += x.value;
        });

        facets.push({
            facet: 'Target Development Level',
            count: rows[1].length,
            values: rows[1]
        });

        return {
            filter: args.filter,
            count: count,
            facets: facets
        };
    });
}

function filterResultFacets(result, args) {
    let facets = result.facets;
    if (args.include) {
        if (args.include != "all") {
            facets = filter(facets, f =>
                find(args.include, x => {
                    var matched = x == f.facet;
                    if (!matched) {
                        var re = new RegExp(x, 'i');
                        matched = re.test(f.facet);
                    }
                    return matched;
                }));
        }
    }

    if (args.exclude) {
        facets = filter(facets, f =>
            find(args.exclude, x => {
                var matched = x == f.facet;
                if (!matched) {
                    var re = new RegExp(x, 'i');
                    matched = re.test(f.facet);
                }
                return !matched;
            }));
    }
    return facets;
}

function toLigand(r, lig) {
    let l = {};
    if (r.lychi_h4) {
        l.ligid = r.lychi_h4;
        if (r.drug) {
            l.isdrug = true;
            l.name = r.drug;
        } else {
            l.name = r.cmpd_name_in_src;
            l.isdrug = false;
        }
    } else if (r.drug) {
        l.ligid = r.drug;
        l.name = r.drug;
        l.isdrug = true;
    } else {
        l.ligid = r.cmpd_id_in_src;
        l.name = r.cmpd_name_in_src;
        l.isdrug = false;
    }

    l.smiles = r.smiles;
    l.description = r.nlm_drug_info;

    l.synonyms = [];
    if (r.cmpd_pubchem_cid) {
        let s = {
            name: 'PubChem',
            value: r.cmpd_pubchem_cid
        };
        if (lig && !filter(lig.synonyms, {name: s.name}))
            lig.synonyms.push(s);
        l.synonyms.push(s);
    }
    if (r.cmpd_id_in_src) {
        let s = {
            name: r.catype,
            value: r.cmpd_id_in_src
        };
        if (lig && !filter(lig.synonyms, {name: s.name}))
            lig.synonyms.push(s);
        l.synonyms.push(s);
    }
    if (r.dcid) {
        let s = {
            name: 'DrugCentral',
            value: r.dcid
        };
        if (lig && !filter(lig.synonyms, {name: s.name}))
            lig.synonyms.push(s);
        l.synonyms.push(s);
    }
    if (r.reference) {
        let s = {
            name: r.source,
            value: r.reference
        };
        if (lig && !filter(lig.synonyms, {name: s.name}))
            lig.synonyms.push(s);
        l.synonyms.push(s);
    }
    return l;
}

module.exports = resolvers;
