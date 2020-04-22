const {DiseaseList} = require("./models/disease/diseaseList");
const {TargetList} = require("./models/target/targetList");
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
            }).catch(function (error) {
                console.error(error);
            });
        },

        targetFacets: async function (_, args, {dataSources}) {
            return new TargetList().AllFacets;
        },

        target: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getTarget(args.q);
            return q.then(rows => {
                if (rows) return rows[0];
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        targets: async function (_, args, {dataSources}) {
            return getTargetResult(args, dataSources.tcrd);
        },

        disease: async function (_, args, {dataSources}) {
            return dataSources.tcrd.getDisease(args.name)
                .then(rows => {
                    if (rows) return rows[0];
                    return rows;
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

        batch: async function (_, args, {dataSources}) {
            let funcs = [
                getTargetResult(args, dataSources.tcrd),
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
        dto: async function (target, args, {dataSources}) {
            return dataSources.tcrd.getDTO(target);

            let nodes = [];
            if (target.dtoid) {
                //console.log('~~~~~ target: ' + target.tcrdid + ' ' + target.dtoid);
                let n = dataSources.tcrd.dto[target.dtoid];
                while (n) {
                    nodes.push(n);
                    n = n.parent;
                }
            }
            return nodes;
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
            const q = dataSources.tcrd.getPPICountsForTarget(target);
            return q.then(rows => {
                return rows;
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

        diseaseCounts: async function (target, _, {dataSources}) {
            const q = dataSources.tcrd.getDiseaseCountsForTarget(target);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        diseases: async function (target, args, {dataSources}, info) {
            //console.log('##### info: '+JSON.stringify(info));
            const q = dataSources.tcrd.getDiseasesForTarget(target, args);
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
            return Promise.all([
                dataSources.tcrd.getLigandCountForTarget(target),
                dataSources.tcrd.getDrugCountForTarget(target)
            ]).then(results => {
                return [{
                    name: "ligand",
                    value: sumAllRows(results[0])
                }, {
                    name: "drug",
                    value: sumAllRows(results[1])
                }];
            }).catch(function (error) {
                console.error(error);
            });

            function sumAllRows(array) {
                let count = 0;
                array.forEach(row => {
                    count += row.cnt;
                });
                return count;
            }
        },

        ligands: async function (target, args, {dataSources}) {
            /*
             * TODO: need to rework to use the ncats_ligand_labels table
             */
            return Promise.all([
                dataSources.tcrd.getLigandLabelsForTarget(target),
                dataSources.tcrd.getDrugLabelsForTarget(target)
            ]).then(allResults => {
                let labelMap = combineResultsIntoUniqueMap(allResults);
                return Array.from(labelMap.keys());
            }).then(labelArray => {
                return Promise.all([
                    dataSources.tcrd.getLigandsForTarget(target, args, labelArray),
                    dataSources.tcrd.getDrugsForTarget(target, args, labelArray)
                ]).then(rows => {
                    const ligs = new Map();
                    if (args.isdrug == false) {
                        addAllLigands(ligs, rows[0]);
                    } else {
                        addAllLigands(ligs, rows[1]);
                    }
                    return Array.from(ligs.values());
                });
            }).catch(function (error) {
                console.error(error);
            });

            function combineResultsIntoUniqueMap(allResults) {
                let labelMap = new Map();
                allResults.forEach(resultSet => {
                    resultSet.forEach(row => {
                        addOrUpdateMap(labelMap, row.label, row.cnt);
                    });
                });
                return labelMap;
            }

            function addOrUpdateMap(labelMap, label, count) {
                let currentCount = labelMap.get(label);
                currentCount = (!!currentCount) ? (currentCount + count) : count;
                labelMap.set(label, currentCount);
            }

            function addAllLigands(ligands, queryResults) {
                queryResults.forEach(dataRow => {
                    let ligandObj = toLigand(dataRow);
                    ligandObj.parent = target;
                    ligands.set(ligandObj.ligid, ligandObj);
                });
            }
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
                props.push({'name': 'novelty', 'value': neighbor.novelty});
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
                        'name': 'evidence',
                        'value': neighbor.evidence
                    });
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
        }
    },

    DiseaseAssociation: {
        targetCounts: async function (disease, _, {dataSources}) {
            const q = dataSources.tcrd
                .getTargetCountsForDiseaseAssociation(disease);
            return q.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        targets: async function (disease, args, {dataSources}) {
            const q = dataSources.tcrd
                .getTargetsForDiseaseAssociation(disease, args);
            return q.then(rows => {
                rows.forEach(x => {
                    x.parent = disease;
                });
                return rows;
            }).catch(function (error) {
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
            return slice(values, args.skip, args.top + args.skip);
        }
    },

    TargetResult: {
        facets: async (result, args, _) => filterResultFacets(result, args),
        targets: async function (result, args, {dataSources}) {
            args.filter = result.filter;
            args.batch = result.batch;
            return dataSources.tcrd.getTargets(args)
                .then(targets => {
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
            return dataSources.tcrd.getDiseases(args)
                .then(diseases => {
                    diseases.forEach(x => {
                        x.filter = result.filter;
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
            return dataSources.tcrd.getLigandLabels(args)
                .then(rows => {
                    let values = new Map();
                    rows.forEach(r => {
                        //console.log('~~~~~ ' + r.label + ' ' + r.count);
                        values.set(r.label, r.count);
                    });
                    return values;
                }).then(values => {
                    let labels = Array.from(values.keys());
                    return Promise.all([
                        dataSources.tcrd.getDrugsForLabels(labels, args),
                        dataSources.tcrd.getLigandsForLabels(labels, args)
                    ]).then(rows => {
                        let ligs = new Map();
                        rows.forEach(r => {
                            r.forEach(rr => {
                                let l = toLigand(rr);
                                l.actcnt = values.get(l.ligid);
                                if (!ligs.has(l.ligid) || l.isdrug)
                                    ligs.set(l.ligid, l);
                            });
                        });

                        return Array.from(ligs.values());
                    }).catch(function (error) {
                        console.error(error);
                    });
                }).catch(function (error) {
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
            return Promise.all([
                dataSources.tcrd.getDrugActivities(ligand, args),
                dataSources.tcrd.getLigandActivities(ligand, args)
            ]).then(rows => {
                let ligact = [];
                rows.forEach(r => {
                    r.forEach(rr => {
                        let act = {
                            actid: rr.id,
                            type: rr.act_type,
                            value: rr.act_value,
                            moa: rr.action_type,
                            target_id: rr.target_id,
                            parent: ligand
                        };
                        ligact.push(act);
                    });
                });
                return ligact;
            }).catch(function (error) {
                console.error(error);
            });
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

function getTargetResult(args, tcrd) {
    //console.log(JSON.stringify(args));
    args.batch = args.targets;
    const targetList = new TargetList(args);
    const proteinListQuery = targetList.fetchProteinList(tcrd);
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
        const countQuery = targetList.getCountQuery(tcrd);
        const facetQueries = targetList.getFacetQueries(tcrd);
        facetQueries.unshift(countQuery);

        return Promise.all(Array.from(facetQueries.values())).then(rows => {
            let count = rows.shift()[0].count;

            let facets = [];
            for (var i in rows) {
                facets.push({
                    facet: targetList.facetsToFetch[i].type,
                    count: rows[i].length,
                    values: rows[i],
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
    let diseaseList = new DiseaseList(args);
    let queries = diseaseList.getFacetQueries(tcrd);
    queries.unshift(diseaseList.getCountQuery(tcrd));

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
    });
}

function getLigandResult(args, tcrd) {
    return Promise.all([
        tcrd.getLigandCounts(args),
        tcrd.getDrugCounts(args),
        tcrd.getActivityCounts(args)
    ]).then(rows => {
        let facets = [];
        let ligcnt = 0;
        rows[0].forEach(r => {
            ligcnt += r.cnt;
        });
        let drugcnt = 0;
        rows[1].forEach(r => {
            drugcnt += r.cnt;
        });

        facets.push({
            facet: 'type',
            count: ligcnt + drugcnt,
            values: [
                {
                    name: 'Ligand',
                    value: ligcnt
                },
                {
                    name: 'Drug',
                    value: drugcnt
                }
            ]
        });

        let acttypes = new Map();
        let actcnt = 0;
        rows[2].forEach(r => {
            let t = r.act_type;
            let v = acttypes.get(t);
            if (v) {
                acttypes.set(t, v + r.cnt);
            } else {
                acttypes.set(t, r.cnt);
            }
            actcnt += r[1];
        });

        facets.push({
            facet: 'activity',
            count: actcnt,
            values: Array.from(acttypes)
                .map(x => ({name: x[0], value: x[1]}))
                .sort((x, y) => y.value - x.value)
        });

        return {
            filter: args.filter,
            count: ligcnt + drugcnt,
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