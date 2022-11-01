const {SequenceSearch} = require("./models/externalAPI/SequenceSearch");
const {PythonCalculation} = require("./models/externalAPI/PythonCalculation");
const {ListContext} = require("./models/listManager");
const {DataModelListFactory} = require("./models/DataModelListFactory");
const {TargetDetails} = require("./models/target/targetDetails");
const {FacetDataType} = require("./models/FieldInfo");
const {LigandList} = require("./models/ligand/ligandList");
const {DiseaseList} = require("./models/disease/diseaseList");
const {TargetList} = require("./models/target/targetList");
const {Virus} = require("./models/virus/virusQuery");
const {performance} = require('perf_hooks');
const {find, filter, slice, partition} = require('lodash');
const {LigandDetails} = require("./models/ligand/ligandDetails");
const { parseResidueData } = require('./utils');
const {DynamicPredictions} = require("./models/externalAPI/DynamicPredictions");
const {VersionInfo} = require('./models/versionInfo/versionInfo');

const resolvers = {

    PharosConfiguration: {
        downloadLists: async function (config, args, {dataSources}) {
            const lists = config.listManager.getDownloadLists(
                args.modelName,
                args.associatedModelName,
                args.similarityQuery,
                args.associatedLigand,
                args.associatedSmiles,
                args.associatedTarget,
                args.sequence);
            const retArray = [];
            lists.forEach((fields, listName) => {
                retArray.push({
                    listName: listName,
                    field: fields
                })
            });
            return retArray;
        }
    },

    Mutation: {
        trackFeature: (_, args, {dataSources}) => {
            const insert = {
                id: null,
                user: args.user,
                feature: args.feature,
                detail1: args.detail1,
                detail2: args.detail2,
                detail3: args.detail3,
                schema: dataSources.tcrd.tableInfo.configDB,
                time_stamp: new Date().toISOString()
            };
            return dataSources.tcrd.db('result_cache.feature_tracking').insert(insert).then(res => {
                return {success: true};
            }).catch((e) => {
                return {success: false, message: e.message};
            });
        }
    },

    SequenceSimilarityDetails: {
        alignments: async function (sequenceSimilarityDetails, args, {dataSources}) {
            if (sequenceSimilarityDetails.alignments && sequenceSimilarityDetails.alignments.length > 0) {
                return sequenceSimilarityDetails.alignments;
            }
            return dataSources.tcrd.db('result_cache.sequence_search_results').select('*')
                .where('query_hash', sequenceSimilarityDetails.sequenceQueryHash)
                .andWhere('uniprot', sequenceSimilarityDetails.uniprot);
        }
    },
    Query: {
        usageData: async function (_, args, {dataSources}) {
            const interval = args.interval;
            let summaryColumn;
            switch (args.interval) {
                case 'day':
                    summaryColumn = "DAYOFYEAR(CONVERT_TZ(time_stamp, 'UTC', 'EST'))";
                    break;
                case 'week':
                    summaryColumn = "week(CONVERT_TZ(time_stamp, 'UTC', 'EST'), 1)";
                    break;
                case 'month':
                    summaryColumn = "month(CONVERT_TZ(time_stamp, 'UTC', 'EST'))";
                    break;
                case 'year':
                    summaryColumn = "year(CONVERT_TZ(time_stamp, 'UTC', 'EST'))";
                    break;
            }
            const knex = dataSources.tcrd.db;
            return knex('result_cache.feature_tracking')
                .select({
                    schema: 'schema',
                    feature: 'feature',
                    uses: knex.raw("count(*)"),
                    users: knex.raw("count(distinct user)"),
                    summary: knex.raw(summaryColumn)
                })
                .groupBy(['schema', 'feature', 'summary'])
                .orderBy(['schema', 'feature', 'summary']);
        },
        listCross: async function (_, args, {dataSources}) {
            if (args.model == 'Target') {
                const listObj = new TargetList(dataSources.tcrd, args);
                await Promise.all([
                    listObj.getDrugTargetPredictions(),
                    listObj.getSimilarSequences()
                ]);
                if (args.crossModel == 'Ligand') {
                    return listObj.getAllLigandActivities();
                } else if (args.crossModel == 'Disease') {
                    return listObj.getAllDiseaseAssociations();
                } else if (args.crossModel == 'Target') {
                    return listObj.getAllTargetInteractions();
                }
            } else if (args.model == 'Disease') {
                const listObj = new DiseaseList(dataSources.tcrd, args);
                if (args.crossModel == 'Target') {
                    return listObj.getAllTargetAssociations();
                }
            } else if (args.model == 'Ligand') {
                const listObj = new LigandList(dataSources.tcrd, args);
                await listObj.getSimilarLigands();
                if (args.crossModel == 'Target') {
                    return listObj.getAllTargetActivities();
                }
            }
            return {};
        },
        getSequenceAlignments: async function (_, args, {dataSources}) {
            const targetList = new TargetList(dataSources.tcrd, args);
            await Promise.all([
                targetList.getDrugTargetPredictions(),
                targetList.getSimilarSequences()
            ]);
            return targetList.getSequenceDetails();
        },
        listCrossDetails: async function (_, args, {dataSources}) {
            //(model:$model, crossModel:$crossModel, filter:$filter, batch:$batch, modelID:$modelID, crossModelID:$crossModelID)
            if (args.model == 'Target') {
                const listObj = new TargetList(dataSources.tcrd, args);
                await Promise.all([
                    listObj.getDrugTargetPredictions(),
                    listObj.getSimilarSequences()
                ]);
                if (args.crossModel == 'Ligand') {
                    return listObj.getLigandActivityDetails(args.modelID, args.crossModelID);
                } else if (args.crossModel == 'Disease') {
                    return listObj.getDiseaseAssociationDetails(args.modelID, args.crossModelID);
                } else if (args.crossModel == 'Target') {
                    return listObj.getTargetInteractionDetails(args.modelID, args.crossModelID);
                }
            } else if (args.model == 'Disease') {
                const listObj = new DiseaseList(dataSources.tcrd, args);
                if (args.crossModel == 'Target') {
                    return listObj.getTargetAssociationDetails(args.modelID, args.crossModelID);
                }
            } else if (args.model == 'Ligand') {
                const listObj = new LigandList(dataSources.tcrd, args);
                await listObj.getSimilarLigands();
                if (args.crossModel == 'Target') {
                    return listObj.getTargetActivityDetails(args.modelID, args.crossModelID);
                }
            }
            return {down: 'up'};
        },

        filterSearch: async function (_, args, {dataSources}) {
            if (!args || !args.term || args.term.trim().length === 0) {
                return [];
            }
            const term = args.term.trim().toLowerCase();
            const targetList = new TargetList(dataSources.tcrd);
            const diseaseList = new DiseaseList(dataSources.tcrd);
            const ligandList = new LigandList(dataSources.tcrd);
            const facetQueries = [...targetList.getFacetQueries(), ...diseaseList.getFacetQueries(), ...ligandList.getFacetQueries()];
            return Promise.all(facetQueries).then(res => {

                const filtered = [];
                const loopObjs = [
                    {
                        list: targetList,
                        model: 'Target'
                    },
                    {
                        list: diseaseList,
                        model: 'Disease'
                    },
                    {
                        list: ligandList,
                        model: 'Ligand'
                    }
                ];

                let resultIndex = 0;
                loopObjs.forEach(entity => {
                    let listIndex = 0;
                    entity.list.facetsToFetch.forEach(facet => {
                        const results = res[resultIndex];
                        const f = [];
                        results.forEach(v => {
                            if (v.name && v.name.toLowerCase().includes(term)) {
                                f.push(v);
                            }
                        });

                        if (f.length > 0) {
                            filtered.push({
                                all: true,
                                model: entity.model,
                                dataType: facet.dataType == FacetDataType.numeric ? "Numeric" : "Category",
                                binSize: facet.binSize,
                                single_response: facet.single_response,
                                facet: facet.name,
                                modifier: facet.typeModifier,
                                count: f.length,
                                values: f,
                                sql: facetQueries[resultIndex].toString(),
                                elapsedTime: entity.list.getElapsedTime(facet.name),
                                sourceExplanation: facet.description
                            });
                        }

                        resultIndex++;
                        listIndex++;
                    });
                });
                return filtered;
            });
        },
        normalizableFilters: async function (_, args, {dataSources}) {
            const targetFilters = dataSources.tcrd.tableInfo.listManager.listMap.get(
                (new ListContext('Target', '', 'facet')).toString()) || [];
            const diseaseFilters = dataSources.tcrd.tableInfo.listManager.listMap.get(
                (new ListContext('Disease', '', 'facet')).toString()) || [];
            const ligandFilters = dataSources.tcrd.tableInfo.listManager.listMap.get(
                (new ListContext('Ligand', '', 'facet')).toString()) || [];
            return {
                targetFacets: targetFilters.filter(f => f.dataType === 'category').map(f => f.name),
                diseaseFacets: diseaseFilters.filter(f => f.dataType === 'category').map(f => f.name),
                ligandFacets: ligandFilters.filter(f => f.dataType === 'category').map(f => f.name)
            };
        },
        hierarchicalFilters: async function (_, args, {dataSources}) {
            return {
                targetFacets: ['DTO Class', 'PANTHER Class'],
                diseaseFacets: [],
                ligandFacets: []
            }
        },
        filterHierarchy: async function(_, args, {dataSources}) {
            console.log(args);
            const listObj = DataModelListFactory.getListObject(args.model, dataSources.tcrd, args);
            await loadRequiredExternalData(listObj);
            return listObj.getHierarchyQuery(args.facetName);
        },
        upset: async function (_, args, {dataSources}) {
            const listObj = DataModelListFactory.getListObject(args.model, dataSources.tcrd, args);
            await loadRequiredExternalData(listObj);
            return listObj.getUpsetQuery(args.facetName, args.values).then(res => {
                // console.log(res);
                return res.map(r => {
                    return {
                        count: r.count,
                        values: r.values.split('|')
                    }
                });
            });
        },

        download: async function (_, args, {dataSources}) {
            let listQuery, listObj;
            try {
                if (args.top) {
                    args.top = Math.min(args.top, 250000);
                } else {
                    args.top = 250000;
                }
                listObj = DataModelListFactory.getListObject(args.model, dataSources.tcrd, args);
                await loadRequiredExternalData(listObj);
                listQuery = listObj.getListQuery('download');
            } catch (e) {
                return {
                    result: false,
                    errorDetails: e.message
                }
            }
            return {
                result: true,
                data: args.sqlOnly ? null : listQuery,
                sql: listQuery.toString(),
                warnings: listObj.warnings
            };
        },

        configuration: async function (_, args, {dataSources}) {
            return dataSources.tcrd.tableInfo;
        },

        autocomplete: async function (_, args, {dataSources}, info) {
            let query = dataSources.tcrd.getSuggestions(args.name);
            return query.then(rows => {
                rows.forEach(row => {
                    let cats = row.category.split('|');
                    if (row.reference_id) {
                        let refs = row.reference_id.split('|');
                        row.categories = [];
                        for (let i = 0; i < cats.length; i++) {
                            row.categories.push({category: cats[i], reference_id: refs[i]});
                        }
                    } else {
                        row.categories = cats.map(c => {
                            return {category: c};
                        });
                    }
                });
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        dataSourceCounts: async function (_, args, {dataSources}) {
            const knex = dataSources.tcrd.db;
            let query = knex(
                {
                    ncats_dataSource_map: 'ncats_dataSource_map',
                    ncats_dataSource: 'ncats_dataSource'
                })
                .select({
                    dataSource: "ncats_dataSource.dataSource",
                    url: knex.raw("url"),
                    license: knex.raw("license"),
                    licenseURL: knex.raw("licenseURL"),
                    targetCount: knex.raw("COUNT(protein_id)"),
                    diseaseCount: knex.raw("COUNT(disease_name)"),
                    ligandCount: knex.raw("COUNT(ncats_ligand_id)")
                })
                .where('ncats_dataSource.dataSource', knex.raw('ncats_dataSource_map.dataSource'))
                .groupBy("dataSource").orderBy("dataSource");
            return query.then(rows => {
                return rows;
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
            const context = new ListContext('Target', '', 'facet');
            const fields = dataSources.tcrd.tableInfo.listManager.listMap.get(context.toString()) || [];
            return fields.map(f => f.name);
        },

        target: async function (_, args, {dataSources}) {
            const q = dataSources.tcrd.getTarget(args.q);
            return q.then(rows => {
                if (rows) {
                    if (rows.length > 0) {
                        dataSources.associatedTargetTCRDID = rows[0].id;
                    }
                    return rows[0];
                }
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        targets: async function (_, args, {dataSources}) {
            return getTargetResult(args, dataSources);
        },

        disease: async function (_, args, {dataSources}) {
            var finder = '"';
            var regExp = new RegExp(finder, 'g');
            var cleanName = args.name.replace(regExp, '');
            return dataSources.tcrd.getDisease(cleanName)
                .then(rows => {
                    rows = filter(rows, r => r.name != null);
                    if (rows.length > 0) {
                        return rows[0];
                    }
                    return {name: cleanName, associationCount: 0, directAssociationCount: 0};
                }).catch(function (error) {
                    console.error(error);
                });
        },

        diseases: async function (_, args, {dataSources}) {
            return getDiseaseResult(args, dataSources.tcrd);
        },

        ligand: async function (_, args, {dataSources}) {
            const ligandDetails = new LigandDetails(dataSources.tcrd.db);
            return ligandDetails.getDetailsQuery(args.ligid).then(rows => {
                if (rows && rows.length > 0) {
                    return rows[0];
                }
                return null;
            });
        },
        ligands: async function (_, args, {dataSources}) {
            return getLigandResult(args, dataSources);
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
            const tryUnbatch = function () {
                if (info && info.fieldNodes && info.fieldNodes.length > 0 &&
                    info.fieldNodes[0].arguments && info.fieldNodes[0].arguments.length > 0 &&
                    info.fieldNodes[0].arguments[0].name) {
                    return info.fieldNodes[0].arguments[0].name.value;
                }
            };
            const model = tryUnbatch();
            if (model == 'targets') {
                return getTargetResult(args, dataSources).then(res => {
                    return {targetResult: res};
                })
            }
            if (model == 'diseases') {
                return getDiseaseResult(args, dataSources.tcrd).then(res => {
                    return {diseaseResult: res};
                })
            }
            if (model == 'ligands') {
                return getLigandResult(args, dataSources).then(res => {
                    return {ligandResult: res};
                })
            }
            console.log('unbatching failed, executing the whole batch');
            let funcs = [
                getTargetResult(args, dataSources),
                getDiseaseResult(args, dataSources.tcrd),
                getLigandResult(args, dataSources)
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
        dataVersions: async function (_, args, {dataSources}) {
            versionInfo = new VersionInfo(dataSources.tcrd.db);
            return versionInfo.getVersion(args.keys);
        },
        predictions: async function (target, args, {dataSources}) {
            return new DynamicPredictions(dataSources.tcrd).fetchTargetAPIs(target);
        },
        affiliate_links: async function (target, args, {dataSources}) {
            let query = dataSources.tcrd.db({extlink: 'extlink', t2tc: 't2tc', affiliate: 'affiliate'})
                .select(
                    {
                        url: 'url',
                        sourceName: 'display_name',
                        description: 'description'
                    })
                .where(dataSources.tcrd.db.raw('extlink.protein_id = t2tc.protein_id'))
                .andWhere('t2tc.target_id', target.tcrdid)
                .andWhere(dataSources.tcrd.db.raw('extlink.source = affiliate.source'))
                .groupBy('extlink.source')
                .orderBy('affiliate.id');
            return query;
        },
        dataSources: async function (target, args, {dataSources}) {
            let query = dataSources.tcrd.db({ncats_dataSource_map: "ncats_dataSource_map", t2tc: "t2tc"})
                .distinct('ncats_dataSource_map.dataSource')
                .where(dataSources.tcrd.db.raw('ncats_dataSource_map.protein_id = t2tc.protein_id'))
                .andWhere("t2tc.target_id", target.tcrdid);
            return query.then(rows => {
                return rows.map(row => row.dataSource);
            })
        },

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
                    theRow.score = theRow.score;
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
            AND ncats_ppi.other_id = (select id from protein where ${this.tcrd.getProteinMatchQuery(dataSources.associatedTarget)}))`,
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
        ligandAssociationDetails: async function (target, args, {dataSources}) {
            if ((target.actVals || target.avgActVal || target.modeOfAction) && dataSources.associatedLigand && dataSources.associatedLigand.length > 0) {
                return {actVals: target.actVals, avgActVal: target.avgActVal, modeOfAction: target.modeOfAction};
            }
            return null;
        },
        targetPredictionDetails: async function (target, args, {dataSources}) {
            if ((target.similarity || target.result) && dataSources.associatedSmiles && dataSources.associatedSmiles.length > 0) {
                return {
                    similarity: target.similarity,
                    result: target.result,
                    training_smiles: target.training_smiles,
                    training_activity: target.training_activity,
                    model_name: target.model_name,
                    target_chembl_id: target.target_chembl_id
                };
            }
            return null;
        },
        sequenceSimilarityDetails: async function (target, args, {dataSources}) {
            if ((target.qcovs || target.bitscore) && dataSources.querySequence && dataSources.querySequence.length > 0) {
                return {
                    pident: target.pident,
                    evalue: target.evalue,
                    bitscore: target.bitscore,
                    qcovs: target.qcovs,
                    uniprot: target.uniprot,
                    queryHash: dataSources.sequenceQueryHash
                };
            }
            return null;

        },
        diseaseCounts: async function (target, args, {dataSources}) {
            let diseaseArgs = args;
            diseaseArgs.filter = diseaseArgs.filter || {};
            diseaseArgs.filter.associatedTarget = target.uniprot;
            let diseaseList = new DiseaseList(dataSources.tcrd, diseaseArgs);
            const q = diseaseList.getListQuery('list');
            return q.then(rows => {
                rows.forEach(x => {
                    x.value = x.count;
                });
                return rows;
            });
        },

        diseases: async function (target, args, {dataSources}) {
            let diseaseArgs = args;
            diseaseArgs.filter = diseaseArgs.filter || {};
            diseaseArgs.filter.associatedTarget = target.uniprot;
            let diseaseList = new DiseaseList(dataSources.tcrd, diseaseArgs);
            const q = diseaseList.getListQuery('list');
            return q.then(diseases => {
                diseases.forEach(x => {
                    x.associationCount = x.count;
                    x.parent = target;
                });
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
            let q = dataSources.tcrd.getPathways(target, args);
            return Promise.all(q).then(rows => {
                const outRows = [];
                rows.forEach(row => {
                    outRows.push(...row);
                });
                outRows.forEach(row => {
                    if (row.type == "Reactome") {
                        row.url = `https://idg.reactome.org/PathwayBrowser/#/${row.sourceID}&FLG=${target.sym}`;
                    }
                });
                return outRows;
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
            return q;
        },
        expressionTree: async function(target, args, {dataSources}) {
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getExpressionTree();
        },
        diseaseTree: async function(target, args, {dataSources}) {
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getDiseaseTree();
        },
        tinxTree: async function(target, args, {dataSources}) {
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getTinxTree();
        },
        tissueSpecificity: async function(target, args, {dataSources}) {
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getTaus();
        },
        gtex: async function (target, args, {dataSources}) {
            const q = dataSources.tcrd.db({t2tc: 't2tc', gtex: 'gtex'})
                .leftJoin('uberon', 'uberon_id', 'uberon.uid')
                .select(['name', 'def', 'comment',
                    `tissue`, `tpm`, `tpm_rank`, `tpm_male`, `tpm_male_rank`, `tpm_female`, `tpm_female_rank`, `uberon_id`])
                .where('gtex.protein_id', dataSources.tcrd.db.raw('t2tc.protein_id'))
                .andWhere('t2tc.target_id', target.tcrdid);
            return q;
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

        gwasAnalytics: async function (target, args, {dataSources}) {
            const geneFieldMap = new Map([]); // there aren't any that are the same across all associations because they may be from different ensg's
            const assocFieldMap = new Map([
                ['TIGA ENSG ID', 'ensgID'],
                ['Trait Count for Gene', 'traitCountForGene'],
                ['Study Count for Gene', 'studyCountForGene'],
                ['TIGA Disease Link', 'ncats_disease_id'],
                ['EFO ID', 'efoID'],
                ['GWAS Trait', 'trait'],
                ['Study Count', 'studyCountForAssoc'],
                ['SNP Count', 'snpCount'],
                ['Weighted SNP Count', 'wSnpCount'],
                ['Gene Count for Trait', 'geneCountForTrait'],
                ['Study Count for Trait', 'studyCountForTrait'],
                ['Median p-value', 'medianPvalue'],
                ['Median Odds Ratio', 'medianOddsRatio'],
                ['Beta Count', 'betaCount'],
                ['Mean Study N', 'meanStudyN'],
                ['RCRAS', 'rcras'],
                ['Mean Rank', 'meanRank'],
                ['Mean Rank Score', 'meanRankScore']
            ]);
            const targetList = new TargetList(
                dataSources.tcrd,
                {
                    batch: [target.uniprot],
                    fields: [...Array.from(geneFieldMap.keys()), ...Array.from(assocFieldMap.keys())],
                    filter: {order: '!Mean Rank Score'}
                });
            return targetList.getListQuery('download', true).then(rows => {
                if (!rows || rows.length === 0) {
                    return null;
                }
                const gwasObj = {};
                geneFieldMap.forEach((v, k) => {
                    gwasObj[v] = rows[0][k];
                });
                gwasObj.associations = [];
                rows.forEach(row => {
                    const assoc = {};
                    assocFieldMap.forEach((v, k) => {
                        assoc[v] = row[k];
                    });
                    gwasObj.associations.push(assoc);
                });
                return gwasObj;
            })
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

            ligandList.facetsToFetch = [ligandList.databaseConfig.listManager.getOneField(ligandList, 'facet', 'Type')];
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
            } else {
                ligandArgs.filter.facets.push({facet: "Type", values: ["Ligand"]});
            }
            return new LigandList(dataSources.tcrd, ligandArgs)
                .getListQuery('list')
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
        },
        similarity: async function (target, args, {dataSources}) {
            if (dataSources.similarity) {
                return target;
            }
            return null;
        },
        sequence_variants: async function (target, args, {dataSources}) {
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getSequenceVariants().then(results => {
                if (!results || results.length < 1) {
                    return null;
                }
                const residueData = parseResidueData(results);
                return {residue_info: residueData, startResidue: results[0].residue};
            });
        },
        sequence_annotations: async function (target, args, {dataSources}) {
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getSequenceAnnotations().then(results => {
                return results;
            });
        },
        facetValueCount: async function (target, args, {dataSources}) {
            if (!args.facetName) {
                return null;
            }
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getFacetValueCount().then(results => {
                if (results && results.length > 0) {
                    return results[0].value;
                }
                return null;
            });
        },
        facetValues: async function (target, args, {dataSources}) {
            if (!args.facetName) {
                return null;
            }
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getAllFacetValues().then(results => {
                return results.map(res => res.value);
            });
        },
        drgc_resources: async function (target, args, {dataSources}) {
            const query = dataSources.tcrd.db('drgc_resource')
                .select({resourceType: 'resource_type', detailBlob: 'json'})
                .where('target_id', target.tcrdid);
            return query.then(rows => {
                return rows.map(row => {
                    return {
                        resourceType: row.resourceType,
                        detailBlob: TargetDetails.LD2JSON(JSON.parse(row.detailBlob))
                    };
                });
            });
        },
        nearestTclin: async function (target, args, {dataSources}) {
            const targetDetails = new TargetDetails(args, target, dataSources.tcrd);
            return targetDetails.getNearestTclin();
        }
    },
    SimilarityDetails: {
        commonOptions: async function (target, args, {dataSources}) {
            if (target && target.commonOptions && dataSources.similarity) {
                const options = target.commonOptions.split('|');
                if (options.length <= 20) {
                    return options;
                }
                return [...options.slice(0, 20), `...and ${target.overlap - 20} more`];
            }
            return null;
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
        predictions: async function (disease, args, {dataSources}) {
            const dids = await resolvers.Disease.dids(disease, args, {dataSources});
            return new DynamicPredictions(dataSources.tcrd).fetchDiseaseAPIs(disease, dids.map(r => {
                const pieces = r.id.split(':');
                if (pieces.length > 0) {
                    return {value: pieces[1], db: pieces[0]};
                }
            }));
        },
        mondoEquivalents: async function (disease, args, {dataSources}) {
            if (disease.mondoID) {
                const query = dataSources.tcrd.db('mondo_xref').select({
                    id: 'xref',
                    name: dataSources.tcrd.db.raw('COALESCE(do.name, omim.title)')
                }).leftJoin('do', 'mondo_xref.xref', 'do.doid')
                    .leftJoin('omim', function () {
                        this.on('mondo_xref.value', 'omim.mim').andOn('mondo_xref.db', dataSources.tcrd.db.raw(`"OMIM"`))
                    })
                    .where('mondo_xref.mondoid', disease.mondoID).andWhere('equiv_to', true);
                return query.then(rows => {
                    return rows;
                });
            }
        },
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
            return targetList.getListQuery('list').then(rows => {
                rows.forEach(x => {
                    x.parent = disease;
                });
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        parents: async function (disease, args, {dataSources}) {
            if (!disease.mondoID) {
                return;
            }
            let query = dataSources.tcrd.db(
                {
                    mondo_child: 'mondo',
                    relationship: 'mondo_parent',
                    mondo_par: 'mondo'
                })
                .leftJoin('ncats_disease', 'mondo_par.mondoid', 'ncats_disease.mondoid')
                .select(
                    {
                        name: 'mondo_par.name',
                        associationCount: dataSources.tcrd.db.raw('coalesce(ncats_disease.target_count, 0)'),
                        directAssociationCount: dataSources.tcrd.db.raw('coalesce(ncats_disease.direct_target_count, 0)'),
                        mondoDescription: 'ncats_disease.mondo_description',
                        mondoID: 'mondo_par.mondoid',
                        doDescription: 'ncats_disease.do_description',
                        uniprotDescription: 'ncats_disease.uniprot_description'
                    }).where('mondo_child.mondoid', disease.mondoID)
                .andWhere('mondo_child.mondoid', dataSources.tcrd.db.raw('relationship.mondoid'))
                .andWhere('relationship.parentid', dataSources.tcrd.db.raw('mondo_par.mondoid'));
            return query.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        children: async function (disease, args, {dataSources}) {
            if (!disease.mondoID) {
                return;
            }
            let query = dataSources.tcrd.db(
                {
                    mondo_par: 'mondo',
                    relationship: 'mondo_parent',
                    mondo_child: 'mondo'
                })
                .leftJoin('ncats_disease', 'mondo_child.mondoid', 'ncats_disease.mondoid')
                .select(
                    {
                        name: 'mondo_child.name',
                        associationCount: dataSources.tcrd.db.raw('coalesce(ncats_disease.target_count, 0)'),
                        directAssociationCount: dataSources.tcrd.db.raw('coalesce(ncats_disease.direct_target_count, 0)'),
                        mondoDescription: 'ncats_disease.mondo_description',
                        mondoID: 'mondo_child.mondoid',
                        doDescription: 'ncats_disease.do_description',
                        uniprotDescription: 'ncats_disease.uniprot_description'
                    }).where('mondo_par.mondoid', disease.mondoID)
                .andWhere('mondo_par.mondoid', dataSources.tcrd.db.raw('relationship.parentid'))
                .andWhere('relationship.mondoid', dataSources.tcrd.db.raw('mondo_child.mondoid'));
            return query.then(rows => {
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },

        tinx: async function (disease, args, {dataSources}) {
            let query = DiseaseList.getTinxQuery(dataSources.tcrd.db, disease.name);
            return query.then(rows => {
                let associationMap = new Map();
                for (let i = 0; i < rows.length; i++) {
                    if (associationMap.has(rows[i].targetID)) {
                        let details = associationMap.get(rows[i].targetID).details;
                        details.push({doid: rows[i].doid, diseaseName: rows[i].name, importance: rows[i].importance});
                    } else {
                        let association = {};
                        association.targetID = rows[i].targetID;
                        association.targetName = rows[i].targetName;
                        association.novelty = rows[i].novelty;
                        association.tdl = rows[i].tdl;
                        association.details = [];
                        association.details.push({
                            doid: rows[i].doid,
                            diseaseName: rows[i].name,
                            importance: rows[i].importance
                        });
                        associationMap.set(rows[i].targetID, association);
                    }
                }
                return associationMap.values();
            }).catch(function (error) {
                console.error(error);
            });
        },
        gwasAnalytics: async function (disease, args, {dataSources}) {
            const traitFieldMap = new Map([
                ['EFO ID', 'efoID'],
                ['GWAS Trait', 'trait'],
                ['Gene Count for Trait', 'geneCount'],
                ['Study Count for Trait', 'studyCount']
            ]);
            const assocFieldMap = new Map([
                ['TIGA Protein ID', 'protein_id'],
                ['TIGA ENSG ID', 'ensgID'],
                ['Study Count', 'studyCount'],
                ['SNP Count', 'snpCount'],
                ['Weighted SNP Count', 'wSnpCount'],
                ['Trait Count for Gene', 'traitCountForGene'],
                ['Study Count for Gene', 'studyCountForGene'],
                ['Median p-value', 'medianPvalue'],
                ['Median Odds Ratio', 'medianOddsRatio'],
                ['Beta Count', 'betaCount'],
                ['Mean Study N', 'meanStudyN'],
                ['RCRAS', 'rcras'],
                ['Mean Rank', 'meanRank'],
                ['Mean Rank Score', 'meanRankScore']
            ]);
            const diseaseList = new DiseaseList(
                dataSources.tcrd,
                {
                    batch: [disease.name],
                    fields: [...Array.from(traitFieldMap.keys()), ...Array.from(assocFieldMap.keys())],
                    filter: {order: '!Mean Rank Score'}
                });
            const query = diseaseList.getListQuery('download', true);
            return query.then(rows => {
                if (!rows || rows.length === 0) {
                    return null;
                }
                const gwasObj = {};
                traitFieldMap.forEach((v, k) => {
                    gwasObj[v] = rows[0][k];
                });
                gwasObj.associations = [];
                rows.forEach(row => {
                    const assoc = {};
                    assocFieldMap.forEach((v, k) => {
                        assoc[v] = row[k];
                    });
                    gwasObj.associations.push(assoc);
                });
                return gwasObj;
            });
        }
    },
    GwasDiseaseAssociation: {
        target: async function (gwasData, args, {dataSources}) {
            return dataSources.tcrd.getTarget({protein_id: gwasData.protein_id})
                .then(rows => {
                    return rows[0];
                }).catch(function (error) {
                    console.error(error);
                });
        }
    },
    GwasTargetAssociation: {
        diseaseName: async function (gwasData, args, {dataSources}) {
            if (!!gwasData.ncats_disease_id) {
                const query = dataSources.tcrd.db('ncats_disease')
                    .select({name: 'name'})
                    .where('id', gwasData.ncats_disease_id);
                return query.then(rows => {
                    if (rows.length > 0) {
                        return rows[0].name;
                    }
                    return null;
                });
            }
            return null;
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
    Uberon: {
        ancestors: async function (expr, args, {dataSources}) {
            const query = dataSources.tcrd.db({uberon: 'uberon', ancestry_uberon: 'ancestry_uberon'})
                .select({
                    uid: 'uid',
                    name: 'name',
                    def: 'def',
                    comment: 'comment'
                }).where('uberon.uid', dataSources.tcrd.db.raw('ancestry_uberon.ancestor_id'))
                .andWhere('oid', expr.uid)
                .andWhere('oid', '!=', dataSources.tcrd.db.raw('ancestor_id'));
            return query;
        }
    },
    GTEXExpression: {
        uberon: async function (expr, args, {dataSources}) {
            if (expr.uberon_id && expr.name) {
                return {
                    uid: expr.uberon_id,
                    name: expr.name,
                    def: expr.def,
                    comment: expr.comment
                };
            }
            return null;
        },
        log2foldchange: async function (expr, args, {dataSources}) {
            if (!expr.tpm_male || !expr.tpm_female) {
                return null;
            }
            return Math.log2(expr.tpm_female / expr.tpm_male)
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
        values: async function (facet, args, {dataSources}) {
            const getTotalCount = () => {
                switch (facet.model) {
                    case 'Target':
                        return dataSources.tcrd.tableInfo.targetCount;
                    case 'Disease':
                        return dataSources.tcrd.tableInfo.diseaseCount;
                    case 'Ligand':
                        return dataSources.tcrd.tableInfo.ligandCount;
                }
            };

            let values = facet.values;
            if (facet.dataType == 'Category' && !facet.usedForFiltering && !facet.nullQuery && facet.enrichFacets) {
                const tables = [];
                for (let i = 0; i < values.length; i++) {
                    const v = values[i];
                    const data = dataSources.tcrd.tableInfo.findValueProbability(facet.model, facet.facet, v.name);
                    if (data) {
                        const inListHasValue = v.value;
                        const outListHasValue = data.count - v.value;
                        const inListNoValue = facet.totalCount - v.value;
                        const outListNoValue = getTotalCount() - inListHasValue - inListNoValue - outListHasValue;

                        v.table = {
                            inListHasValue: inListHasValue,
                            inListNoValue: inListNoValue,
                            outListHasValue: outListHasValue,
                            outListNoValue: outListNoValue
                        };

                        tables.push([[inListHasValue, outListHasValue], [inListNoValue, outListNoValue]]);
                        v.data = data;
                        v.data.facetCount = facet.totalCount;
                    }
                }
                if (tables.length > 0) {
                    const stats = await new PythonCalculation().calculateFisherTest(tables).then(results => {
                        values.forEach((val, index) => {
                            const oddsRatio = (val.table.inListHasValue * val.table.outListNoValue) /
                                (val.table.inListNoValue * val.table.outListHasValue);
                            const stErr = Math.sqrt(1 / val.table.inListHasValue + 1 / val.table.inListNoValue +
                                1 / val.table.outListHasValue + 1 / val.table.outListNoValue);
                            const zHalfAlpha = 1.96; // for 95% confidence and alpha = 0.5
                            const upper95 = Math.exp(Math.log(oddsRatio) + zHalfAlpha * stErr);
                            const lower95 = Math.exp(Math.log(oddsRatio) - zHalfAlpha * stErr);
                            val.stats = {
                                oddsRatio: {
                                    value: oddsRatio.toString(),
                                    upper95: upper95.toString(),
                                    lower95: lower95.toString()
                                },
                                pValue: results[index][1]
                            };
                        });
                    });

                    values.sort((a, b) => {
                        return a.stats.pValue - b.stats.pValue;
                    });

                    let last = 0;
                    values.forEach((val, index) => {
                        const data = val.data;
                        const tempQ = val.stats.pValue * values.length / (index + 1);
                        val.stats.qValue = Math.min(Math.max(last, tempQ), 1);
                        if (val.stats.qValue <= 0.05) {
                            val.stats.rejected = true;
                        } else {
                            val.stats.rejected = false;
                        }
                        val.stats.statistic = val.value / data.facetCount;
                        val.stats.nullValue = data.p;
                        last = val.stats.qValue;
                    });
                }
                values.splice(1000);
            }
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
            if (facet.dataType == "Numeric" || args.all || facet.all) {
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
            const listObj = new TargetList(dataSources.tcrd, args);
            await Promise.all([
                listObj.getDrugTargetPredictions(),
                listObj.getSimilarSequences()
            ]);
            dataSources.associatedTarget = listObj.associatedTarget;
            dataSources.associatedDisease = listObj.associatedDisease;
            dataSources.similarity = listObj.similarity;
            dataSources.associatedSmiles = listObj.associatedSmiles;
            dataSources.querySequence = listObj.querySequence;
            dataSources.queryHash = listObj.structureQueryHash;
            dataSources.sequenceQueryHash = listObj.sequenceQueryHash;
            dataSources.associatedLigand = listObj.associatedLigand;
            const q = listObj.getListQuery('list');
            return q.then(targets => {
                dataSources.listResults = targets;
                return targets;
            }).catch(function (error) {
                console.error(error);
            });
        },
        similarityTarget: async function (target, args, {dataSources}) {
            if (dataSources.similarity && dataSources.similarity.match) {
                return resolvers.Query.target(null, {q: {uniprot: dataSources.similarity.match}}, {dataSources});
            }
            return null;
        }
    },

    DiseaseResult: {
        facets: async (result, args, _) => filterResultFacets(result, args),
        diseases: async function (result, args, {dataSources}) {
            args.filter = result.filter;
            args.batch = result.batch;
            return new DiseaseList(dataSources.tcrd, args).getListQuery('list')
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
            args.batch = result.batch;
            let ligandList = new LigandList(dataSources.tcrd, args);
            await ligandList.getSimilarLigands();
            return ligandList.getListQuery('list').then(
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
                    values.set(r.name, {value: r.value, sources: r.sources.split('|')});
                });

                let stats = [];
                map.forEach(r => {
                    let v = values.get(r);
                    if (!v) {
                        v = {value: 0};
                    }
                    stats.push({name: r, value: v.value, sources: v.sources});
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
        predictions: async function (ligand, args, {dataSources}) {
            return new DynamicPredictions(dataSources.tcrd).fetchLigandAPIs(ligand);
        },
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
                    target_id: 'target_id',
                    reference: 'reference',
                    pubs: 'pubmed_ids'
                })
                .whereRaw(`ncats_ligands.identifier = "${ligand.ligid}"`)
                .andWhere(dataSources.tcrd.db.raw(`ncats_ligand_activity.ncats_ligand_id = ncats_ligands.id`));
            if (dataSources.associatedTargetTCRDID) {
                query.andWhere(dataSources.tcrd.db.raw(`ncats_ligand_activity.target_id = ${dataSources.associatedTargetTCRDID}`));
            }
            return query.then(rows => {
                for (let i = 0; i < rows.length; i++) {
                    rows[i].parent = ligand;
                    if (rows[i].pubs) {
                        rows[i].pubs = rows[i].pubs.split('|').map(r => {
                            return {pmid: r};
                        });
                    }
                }
                return rows;
            }).catch(function (error) {
                console.error(error);
            });
        },
        synonyms: async function (ligand, args, {dataSources}) {
            const parser = function (row) {
                let synonyms = [];
                for (let field of ['unii', 'PubChem', 'Guide to Pharmacology', 'ChEMBL', 'DrugCentral', 'pt']) {
                    if (row[field]) {
                        synonyms.push({name: field, value: row[field]});
                    }
                }
                synonyms.push({name: "LyCHI", value: ligand.ligid});
                return synonyms;
            };

            let synonyms = [];
            if (!ligand['PubChem'] && !ligand['Guide to Pharmacology'] && !ligand['ChEMBL'] && !ligand['DrugCentral'] && !ligand['unii'] && !ligand['pt']) {
                let query = dataSources.tcrd.db('ncats_ligands')
                    .select(['unii', 'PubChem', 'Guide to Pharmacology', 'ChEMBL', 'DrugCentral', 'pt'])
                    .where('identifier', ligand.ligid);
                return query.then(rows => {
                    return parser(rows[0]);
                });
            }
            return parser(ligand);

        },
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
            if (tinx.doid && dataSources.tcrd.doTree[tinx.doid]) {
                return dataSources.tcrd.doTree[tinx.doid];
            }
            // console.error('No doid in TINX ' + JSON.stringify(tinx));
            return null;
        }
    }
};

async function getTargetResult(args, dataSources) {
    //console.log(JSON.stringify(args));
    args.batch = args.targets;
    const targetList = new TargetList(dataSources.tcrd, args);
    await Promise.all([
        targetList.getDrugTargetPredictions(),
        targetList.getSimilarSequences()
    ]);
    dataSources.associatedTarget = targetList.associatedTarget;
    dataSources.associatedDisease = targetList.associatedDisease;
    dataSources.similarity = targetList.similarity;
    dataSources.associatedSmiles = targetList.associatedSmiles;
    dataSources.associatedLigand = targetList.associatedLigand;
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
                if (targetList.facetsToFetch[i].dataType == FacetDataType.numeric) {
                    rowData = rowData.map(p => {
                        p.name = p.bin;
                        return p
                    })
                }
                facets.push({
                    model: 'Target',
                    totalCount: count,
                    usedForFiltering: targetList.filteringFacets.map(f => f.name).includes(targetList.facetsToFetch[i].name),
                    nullQuery: targetList.isNull(),
                    dataType: targetList.facetsToFetch[i].dataType == FacetDataType.numeric ? "Numeric" : "Category",
                    binSize: targetList.facetsToFetch[i].binSize,
                    single_response: targetList.facetsToFetch[i].single_response,
                    facet: targetList.facetsToFetch[i].name,
                    modifier: targetList.facetsToFetch[i].typeModifier,
                    count: rowData.length,
                    values: rowData,
                    sql: facetQueries[i].toString(),
                    elapsedTime: targetList.getElapsedTime(targetList.facetsToFetch[i].name),
                    sourceExplanation: targetList.facetsToFetch[i].description
                });
            }
            return {
                filter: args.filter,
                batch: args.targets,
                count: count,
                facets: facets
            };
        }).catch(error => {
            console.error(error);
        });
    }
}

function getDiseaseResult(args, tcrd) {
    args.batch = args.diseases;
    let diseaseList = new DiseaseList(tcrd, args);
    let queries = diseaseList.getFacetQueries();
    queries.unshift(diseaseList.getCountQuery());
    return Promise.all(queries).then(rows => {
        let count = rows.shift()[0].count;
        queries.shift();

        let facets = [];
        for (var i in rows) {
            let rowData = rows[i];
            if (diseaseList.facetsToFetch[i].dataType == FacetDataType.numeric) {
                rowData = rowData.map(p => {
                    p.name = p.bin;
                    return p;
                })
            }
            facets.push({
                model: 'Disease',
                totalCount: count,
                usedForFiltering: diseaseList.filteringFacets.map(f => f.name).includes(diseaseList.facetsToFetch[i].name),
                nullQuery: diseaseList.isNull(),
                dataType: diseaseList.facetsToFetch[i].dataType == FacetDataType.numeric ? "Numeric" : "Category",
                binSize: diseaseList.facetsToFetch[i].binSize,
                single_response: diseaseList.facetsToFetch[i].single_response,
                sql: queries[i].toString(),
                elapsedTime: diseaseList.getElapsedTime(diseaseList.facetsToFetch[i].name),
                facet: diseaseList.facetsToFetch[i].name,
                modifier: diseaseList.facetsToFetch[i].typeModifier,
                count: rowData.length,
                values: rowData,
                sourceExplanation: diseaseList.facetsToFetch[i].description
            })
        }

        return {
            filter: args.filter,
            batch: args.diseases,
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

async function getLigandResult(args, dataSources) {
    args.batch = args.ligands;
    let ligandList = new LigandList(dataSources.tcrd, args);
    await ligandList.getSimilarLigands();
    const countQuery = ligandList.getCountQuery();
    const facetQueries = ligandList.getFacetQueries();
    facetQueries.unshift(countQuery);
    return Promise.all(facetQueries).then(rows => {
        facetQueries.shift();
        let count = rows.shift()[0].count;
        let facets = [];
        for (var i in rows) {
            let rowData = rows[i];
            if (ligandList.facetsToFetch[i].valuesDelimited) {
                rowData = splitOnDelimiters(rows[i]);
            }
            if (ligandList.facetsToFetch[i].dataType == FacetDataType.numeric) {
                rowData = rowData.map(p => {
                    p.name = p.bin;
                    return p
                })
            }
            facets.push({
                model: 'Ligand',
                totalCount: count,
                usedForFiltering: ligandList.filteringFacets.map(f => f.name).includes(ligandList.facetsToFetch[i].name),
                nullQuery: ligandList.isNull(),
                dataType: ligandList.facetsToFetch[i].dataType == FacetDataType.numeric ? "Numeric" : "Category",
                binSize: ligandList.facetsToFetch[i].binSize,
                single_response: ligandList.facetsToFetch[i].single_response,
                facet: ligandList.facetsToFetch[i].name,
                modifier: ligandList.facetsToFetch[i].typeModifier,
                count: rowData.length,
                values: rowData,
                sql: facetQueries[i].toString(),
                elapsedTime: ligandList.getElapsedTime(ligandList.facetsToFetch[i].name),
                sourceExplanation: ligandList.facetsToFetch[i].description
            });
        }
        return {
            filter: args.filter,
            batch: args.ligands,
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
    facets.forEach(f => f.enrichFacets = args.enrichFacets);
    return facets;
}

async function loadRequiredExternalData(listObj) {
    if (listObj instanceof LigandList) {
        await listObj.getSimilarLigands();
    }
    if (listObj instanceof TargetList) {
        await Promise.all([
            listObj.getDrugTargetPredictions(),
            listObj.getSimilarSequences()
        ]);
    }
}

module.exports = resolvers;
