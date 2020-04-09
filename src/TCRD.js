const {SQLDataSource} = require("datasource-sql");
const CONSTANTS = require("./constants");
const utils = require("./target_search_utils");

const TARGET_SQL = `
a.*,b.dtoid,b.uniprot,b.seq,b.sym,e.score as novelty, a.id as tcrdid, 
b.description as name, f.string_value as description
from target a, protein b, t2tc c
left join tinx_novelty e use index(tinx_novelty_idx3)
on e.protein_id = c.protein_id
left join tdl_info f on f.protein_id = c.protein_id 
and f.itype = '${CONSTANTS.DESCRIPTION_TYPE}'
where a.id = c.target_id and b.id = c.protein_id
`;


function targetFacetMapping(facet) {
    switch (facet) {
        case 'Target Development Level':
            return 'tdl';
        case 'Family':
            return 'fam';
        case 'Keyword':
            return 'UniProt Keyword';
        case 'Indication':
            return 'DrugCentral Indication';
        case 'Monarch Disease':
            return 'Monarch';
        case 'IMPC Phenotype':
            return 'IMPC';
        case 'JAX/MGI':
        case 'JAX/MGI Phenotype':
            return 'JAX/MGI Human Ortholog Phenotype';
        default:
            if (facet.startsWith('Expression:'))
                return 'Expression';
    }
    return facet;
}

function diseaseFacetMapping(facet) {
    switch (facet) {
        case 'type':
        case 'Data Source':
            return 'dtype';

        case 'Target Development Level':
            return 'tdl';
    }
    return facet;
}

function dtoTraversal(matches, node, args) {
    var matched = node.name == args.name;
    if (!matched) {
        matched = node.name.indexOf(args.name) >= 0;
    }

    if (!matched) { // assume regex
        var re = new RegExp(args.name, 'i');
        matched = re.test(node.name);
    }

    if (matched)
        matches.push(node);
    for (var n in node.children)
        dtoTraversal(matches, node.children[n], args);
}

function diseaseOntologyTraversal(matches, node, args) {
    if (args.doid) {
        if (node.doid == args.doid) {
            matches.push(node);
            return;
        }

        for (var n in node.children)
            diseaseOntologyTraversal(matches, node.children[n], args);
    } else {
        var matched = node.name == args.name;
        if (!matched) {
            var re = new RegExp(args.name, 'i');
            matched = re.test(node.name);
        }
        if (matched)
            matches.push(node);

        for (var n in node.children)
            diseaseOntologyTraversal(matches, node.children[n], args);
    }
}

class TCRD extends SQLDataSource {
    constructor(config) {
        super(config);
        const _this = this;

        const root = {
            doid: 'DOID:4',
            name: 'disease',
            def: `A disease is a disposition (i) to undergo pathological processes that (ii) exists in an organism because of one or more disorders in that organism.`,
            parents: [],
            children: []
        };

        this.doTree = {};
        this.doTree[root.doid] = root;
        this.getDOHierarchy()
            .then(rows => {
                rows.forEach(r => {
                    let d = _this.doTree[r.doid];
                    if (!d) {
                        d = {
                            doid: r.doid,
                            name: r.name,
                            def: r.def,
                            parents: [],
                            _parents: [],
                            children: []
                        };
                        _this.doTree[r.doid] = d;
                    }

                    if (r.parent_id) {
                        let p = _this.doTree[r.parent_id];
                        if (p) {
                            d.parents.push(p);
                            p.children.push(d);
                        } else {
                            d._parents.push(r.parent_id);
                        }
                    }
                });

                for (var key in _this.doTree) {
                    let n = _this.doTree[key];
                    for (var i in n._parents) {
                        let id = n._parents[i];
                        let p = _this.doTree[id];
                        if (p) {
                            n.parents.push(p);
                            p.children.push(n);
                        } else if (id == root.doid) {
                            root.children.push(n);
                            n.parents.push(root);
                        } else {
                            console.error("Can't locate parent "
                                + id + " for node " + n.doid);
                        }
                    }
                }

                for (var key in _this.doTree) {
                    let n = _this.doTree[key];
                    if (n.parents.length == 0) {
                        //console.log('!!!!! '+n.doid+' '+n.name);
                    }
                }

            }).catch(function (error) {
            console.error(error);
        });

        this.dto = {};
        this.getDTOHierarchy()
            .then(rows => {
                rows.forEach(r => {
                    let d = _this.dto[r.id];
                    if (!d) {
                        d = {
                            dtoid: r.id,
                            name: r.name,
                            children: []
                        };
                        _this.dto[r.id] = d;
                    }

                    if (r.parent) {
                        let p = _this.dto[r.parent];
                        if (p) {
                            d.parent = p;
                            p.children.push(d);
                        } else d._parent = r.parent;
                    }
                });

                for (var key in _this.dto) {
                    let n = _this.dto[key];
                    if (n._parent) {
                        n.parent = _this.dto[n._parent];
                        if (n.parent) {
                            n.parent.children.push(n);
                        } else {
                            console.warn('DTO node ' + n.dtoid
                                + ' has nonexistence parent '
                                + n._parent);
                        }
                    }
                }

                for (var key in _this.dto) {
                    let n = _this.dto[key];
                    if (!n.parent) {
                        //console.log('!!!!! '+n.dtoid+' '+n.name);
                    }
                }
            }).catch(function (error) {
            console.error(error);
        });

        this.gaTypes = [];
        this.getGeneAttributeTypes()
            .then(rows => {
                //console.log('~~~~~~ Gene Attribute Types');
                rows.forEach(r => {
                    //console.log('...'+r.attribute_type);
                    _this.gaTypes.push(r.attribute_type);
                });
            }).catch(function (error) {
            console.error(error);
        });

        this.gaGroups = [];
        this.getGeneAttributeGroups()
            .then(rows => {
                //console.log('~~~~~~ Gene Attribute Groups');
                rows.forEach(r => {
                    //console.log('...'+r.attribute_group);
                    _this.gaGroups.push(r.attribute_group);
                });
            }).catch(function (error) {
            console.error(error);
        });

        this.gaCategories = [];
        this.getGeneAttributeCategories()
            .then(rows => {
                //console.log('~~~~~~ Gene Attribute Categories');
                rows.forEach(r => {
                    //console.log('...'+r.resource_group);
                    _this.gaCategories.push(r.resource_group);
                });
            }).catch(function (error) {
            console.error(error);
        });
    }

    getTargetGOFacetSubquery(values, prefix) {
        let q = this.db.select(this.db.raw(`protein_id from goa`))
            .whereIn('go_term', values.map(x => {
                if (!x.startsWith(prefix))
                    return prefix + x;
                return x;
            }));
        return q;
    }

    getTargetFacetSubQueries(facets) {
        let subqueries = []
        for (var i in facets) {
            let f = facets[i];
            let fn = targetFacetMapping(f.facet);
            switch (fn) {
                case 'tdl': {
                    let q = this.db.select(this.db.raw(`
protein_id from target a, t2tc b`))
                        .whereIn('tdl', f.values)
                        .andWhere(this.db.raw(`a.id = b.target_id`));
                    subqueries.push(q);
                }
                    break;

                case 'fam': {
                    let q = this.db.select(this.db.raw(`
protein_id from target a, t2tc b`));
                    let fam = [];
                    let hasNull = false;

                    f.values.forEach(v => {
                        switch (v) {
                            case 'Ion Channel':
                                v = 'IC';
                                break;
                            case 'TF-Epigenetic':
                                v = 'TF; Epigenetic';
                                break;
                            case 'Transcription Factor':
                                v = 'TF';
                                break;
                            case 'Nuclear Receptor':
                                v = 'NR';
                                break;
                            case 'Other':
                            case 'Non-IDG':
                                v = null;
                                break;
                        }
                        if (v != null)
                            fam.push(v);
                        else
                            hasNull = true;
                    });

                    if (hasNull) {
                        q = q.where(sub =>
                            sub.whereIn('fam', fam).orWhereNull('fam'));
                    } else {
                        q = q.whereIn('fam', fam);
                    }

                    q = q.andWhere(this.db.raw(`a.id = b.target_id`));
                    subqueries.push(q);
                }
                    break;

                case 'UniProt Keyword': {
                    let q = this.db.select(this.db.raw(`protein_id from xref`))
                        .whereIn('xtra', f.values)
                        .andWhere(this.db.raw(`xtype = ?`, [fn]));
                    subqueries.push(q);
                }
                    break;

                case 'UniProt Disease':
                case 'Monarch':
                case 'DrugCentral Indication': {
                    let q = this.db.select(this.db.raw(`
distinct protein_id from disease`))
                        .whereIn('name', f.values)
                        .andWhere(this.db.raw(`dtype = ?`, [fn]));
                    subqueries.push(q);
                }
                    break;

                case 'Ortholog': {
                    let q =
                        this.db.select(this.db.raw(`
distinct protein_id from ortholog`))
                            .whereIn('species', f.values);
                    subqueries.push(q);
                }
                    break;

                case 'JAX/MGI Human Ortholog Phenotype': {
                    let q = this.db('phenotype')
                        .distinct('protein_id')
                        .whereIn('term_name', f.values)
                        .andWhere('ptype', fn);
                    console.log(q.toString());
                    subqueries.push(q);
                }
                break;

                case 'IMPC': {
                    let q = this.db.select(this.db.raw(`
distinct a.protein_id from ortholog a, nhprotein c, phenotype d`))
                        .whereIn('term_name', f.values)
                        .andWhere(this.db.raw(`
a.geneid = c.geneid and a.taxid = c.taxid
and c.id = d.nhprotein_id and d.ptype = ?`, [fn]));
                    subqueries.push(q);
                }
                    break;

                case 'GO Component':
                    subqueries.push(this.getTargetGOFacetSubquery(f.values, 'C:'));
                    break;

                case 'GO Process':
                    subqueries.push(this.getTargetGOFacetSubquery(f.values, 'P:'));
                    break;

                case 'GO Function':
                    subqueries.push(this.getTargetGOFacetSubquery(f.values, 'F:'));
                    break;

                case 'Expression': {
                    let type = f.facet.substring(11).trim();
                    let q = this.db.select(this.db.raw(`
distinct protein_id from expression`))
                        .whereIn('tissue', f.values)
                        .andWhere(this.db.raw(`etype = ?`, type));
                    subqueries.push(q);
                }
                    break;

                case 'GWAS': {
                    let q = this.db.select(this.db.raw(`
distinct protein_id from gwas`))
                        .whereIn('disease_trait', f.values);
                    subqueries.push(q);
                }
                    break;
            }
        }
        return subqueries;
    }

    getDiseaseFacetSubQueries(facets) {
        let subqueries = [];
        if (facets) {
            facets.forEach(f => {
                let fn = diseaseFacetMapping(f.facet);
                switch (fn) {
                    case 'dtype': {
                        let q = this.db.select(this.db.raw(`
id from disease`))
                            .whereIn('dtype', f.values);
                        subqueries.push(q);
                    }
                        break;

                    case 'tdl': {
                        let q = this.db.select(this.db.raw(`
distinct a.id from disease a, target b, t2tc c`))
                            .whereIn('b.tdl', f.values)
                            .andWhere(this.db.raw(`a.protein_id = c.protein_id
and b.id = c.target_id`));
                        subqueries.push(q);
                    }
                        break;
                }
            });
        }
        return subqueries;
    }

    getTarget(args) {
        //console.log('>>> getTarget: '+JSON.stringify(args));
        if (args.uniprot || args.sym || args.stringid) {
            var value;
            if (args.uniprot) value = args.uniprot;
            else if (args.sym) value = args.sym;
            else value = args.stringid;
            return this.db.select(this.db.raw(TARGET_SQL + `
and match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)`, [value]));
        }

        if (args.geneid) {
            return this.db.select(this.db.raw(TARGET_SQL + `
and b.geneid=?`, [args.geneid]));
        }

        return this.db.select(this.db.raw(TARGET_SQL + `
and a.id = ?`, [args.tcrdid]));
    }

    getGOCountsForTarget(target) {
        return this.db.select(this.db.raw(`
substr(go_term,1,1) as name, count(*) as value 
from goa a, t2tc b where a.protein_id = b.protein_id
and b.target_id = ?
group by substr(go_term, 1, 1)
order by value desc`, [target.tcrdid]));
    }

    getGOTermsForTarget(target, args) {
        let q = this.db.select(this.db.raw(`
*,go_id as goid, substr(go_term,1,1) as type, substring(go_term,3) as term
from goa a, t2tc b
`));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                switch (f.facet) {
                    case 'type':
                        q = q.whereIn(this.db.raw(`substr(go_term,1,1)`), f.values);
                        break;
                }
            }

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(a.go_term) against(? in boolean mode)`, [t]));
            }
        }

        q = q.andWhere(this.db.raw(`a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]))
            .groupBy('a.go_term');

        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getGOTermsForTarget: '+q);
        return q;
    }

    getMIMCountForTarget(target) {
        return this.db.select(this.db.raw(`count(*) as cnt
from xref a, t2tc b
where a.protein_id = b.protein_id
and a.xtype = ?
and b.target_id = ?`, ['MIM', target.tcrdid]));
    }

    getMIMForTarget(target, args) {
        return this.db.select(this.db.raw(`
a.mim as mimid, a.title as term
from omim a, xref b, t2tc c
where a.mim = b.value 
and b.protein_id = c.protein_id
and b.xtype = ?
and c.target_id = ?`, ['MIM', target.tcrdid]));
    }

    getDiseaseDataSourceCounts(args) {
        let q = this.db.select(this.db.raw(`
dtype as name, count(distinct name) as value
from disease`));
        if (args.filter) {
            let sub = this.getDiseaseFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(name, description, drug_name) against(? in boolean mode)`, [t]));
            }
        }

        q = q.groupBy('dtype')
            .orderBy('value', 'desc');

        //console.log('>>> getDiseaseDataSourceCounts: '+q);
        return q;
    }

    getDiseaseTDLCounts(args) {
        let q = this.db.select(this.db.raw(`
a.tdl as name, count(distinct c.name) as value
from target a, t2tc b, disease c`));

        if (args.filter) {
            let sub = this.getDiseaseFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('c.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(c.name, c.description, c.drug_name) against(? in boolean mode)`, [t]));
            }
        }
        q = q.andWhere(this.db.raw(`
a.id = b.target_id and b.protein_id = c.protein_id`))
            .groupBy('a.tdl')
            .orderBy('value', 'desc');

        //console.log('>>> getDiseaseTDLCounts: '+q);
        return q;
    }

    getDiseaseDrugCounts(args) {
        let q = this.db.select(this.db.raw(`
drug_name as name, count(distinct name) as value
from disease`));

        if (args.filter) {
            let sub = this.getDiseaseFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(name, description, drug_name) against(? in boolean mode)`, [t]));
            }
        }
        q = q.andWhere(this.db.raw(`drug_name is not null`))
            .groupBy('name')
            .orderBy('value', 'desc');

        //console.log('>>> getDiseaseDrugCounts: '+q);
        return q;
    }

    getDisease(name) {
        let q = this.db.select(this.db.raw(`
name,count(*) as associationCount
from disease
where name = ?`, [name]));
        return q;
    }

    getDiseases(args) {
        let q = this.db.select(this.db.raw(`
name,count(*) as associationCount
from disease`));

        if (args.filter) {
            let sub = this.getDiseaseFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t != '') {
                q = q.andWhere(this.db.raw(`
match(name, description, drug_name) against(? in boolean mode)`, [t]));
            }
        }

        q = q.groupBy('name')
            .orderBy('associationCount', 'desc');
        if (args.top)
            q = q.limit(args.top);

        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getDiseases: '+q);
        return q;
    }

    getDiseaseCountsForTarget(target) {
        return this.db.select(this.db.raw(`
a.name, count(*) as value
from disease a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?
group by a.name 
order by value desc`, [target.tcrdid]));
    }

    getDiseaseAssociations(args, constraints) {
        let q = this.db.select(this.db.raw(`
*,id as disassid, dtype as type, drug_name as drug
from disease`));
        if (args.filter) {
            let sub = this.getDiseaseFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(name, description, drug_name) against(? in boolean mode)`, [t]));
            }
        }

        if (constraints)
            q = constraints(q);

        if (args.top)
            q = q.limit(args.top);

        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getDiseaseAssociations: '+q);
        return q;
    }

    getDiseaseAssociationsForDisease(disease, args) {
        //console.log('~~~~ disease: '+JSON.stringify(disease));
        return this.getDiseaseAssociations(args, q => {
            q = q.andWhere(this.db.raw(`name = ?`, [disease.name]));
            if (disease.parent) {
                if (disease.parent.tcrdid) {
                    let subq = this.db.select(this.db.raw(`
a.id from disease a, t2tc b
where a.protein_id = b.protein_id 
and b.target_id = ?`, [disease.parent.tcrdid]));
                    q = q.whereIn('id', subq);
                }
            }
            return q;
        });
    }

    getPub(pmid) {
        return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed where id = ?`, [pmid]));
    }

    getPubCount(args) {
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
count(*) as cnt from pubmed 
where match(title,abstract) against(? in boolean mode)`, [args.term]));
        }
        return this.db.select(this.db.raw(`
count(*) as cnt from pubmed`));
    }

    getPubTDLCounts(args) {
        let q = this.db.select(this.db.raw(`
a.tdl as name, count(*) as value
from target a, protein b, protein2pubmed c, pubmed d, t2tc e`));

        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.facet, f.values);
            }

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(d.title, d.abstract) against(? in boolean mode)`, [t]));
            }
        }
        q = q.andWhere(this.db.raw(`
a.id = e.target_id and b.id = e.protein_id
and c.protein_id = e.protein_id
and c.pubmed_id = d.id`))
            .groupBy('a.tdl')
            .orderBy('value', 'desc');

        //console.log('>>> getPubTDLCounts: '+q);
        return q;
    }

    getPubs(args) {
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed where match(title,abstract) against(? in boolean mode) 
order by date desc, pmid desc
limit ? offset ?`, [args.term, args.top, args.skip]));
        }
        return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed order by date desc, pmid desc 
limit ? offset ?`, [args.top, args.skip]));
    }

    getXrefsForTarget(target) {
        //console.log('>>> getXrefsForTarget: '+target.tcrdid);
        return this.db.select(this.db.raw(`
xtype as source, value as name, xtra as value 
from xref where protein_id = ?`, [target.tcrdid]));
    }

    getPropsForTarget(target) {
        //console.log('>>> getProps: '+target.tcrdid);
        return this.db.select(this.db.raw(`
a.* from tdl_info a, t2tc b
where b.target_id = ? and a.protein_id = b.protein_id`, [target.tcrdid]));
    }

    getSynonymsForTarget(target) {
        return this.db.select(this.db.raw(`
a.type as name, a.value as value  
from alias a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
    }

    getTargetsForXref(xref) {
        //console.log('>>> getTargetForXref: '+JSON.stringify(xref));
        return this.db.select(this.db.raw(`
a.*,b.uniprot,b.sym,b.seq,a.id as tcrdid, 
b.description as name, f.string_value as description
from target a, protein b, t2tc c, xref d
left join tdl_info f on f.protein_id = d.protein_id 
and f.itype = '${CONSTANTS.DESCRIPTION_TYPE}'
where a.id = c.target_id and b.id = c.protein_id
and b.id = d.protein_id and d.xtype = ? and d.value = ?
`, [xref.source, xref.value]));
    }

    getXref(args) {
        //console.log('>>> getXref: '+JSON.stringify(args));
        return this.db.select(this.db.raw(`
xtype as source, value 
from xref where xtype = ? and value = ?`, [args.source, args.value]));
    }

    getPubCountForTarget(target) {
        //console.log('>>> getPubCount: '+target.tcrdid);
        return this.db.select(this.db.raw(`
count(distinct a.id) as cnt
from pubmed a, protein2pubmed b, t2tc c 
where a.id = b.pubmed_id and b.protein_id = c.protein_id 
and c.target_id = ?`, [target.tcrdid]));
    }

    getPubsForTarget(target, args) {
        //console.log('>>> getPubs: '+target.tcrdid+' '+args);
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
a.id as pmid, title, journal, date, abstract
from pubmed a, protein2pubmed b, t2tc c 
where match(a.title,a.abstract) against(? in boolean mode) 
and a.id = b.pubmed_id and b.protein_id = c.protein_id 
and c.target_id = ? 
order by date desc, pmid desc
limit ? offset ?`, [args.term, target.tcrdid, args.top, args.skip]));
        }

        return this.db.select(this.db.raw(`
a.id as pmid, title, journal, date, abstract
from pubmed a, protein2pubmed b, t2tc c 
where a.id = b.pubmed_id and b.protein_id = c.protein_id 
and c.target_id = ? order by date desc, pmid desc limit ? offset ?`,
            [target.tcrdid,
                args.top, args.skip]));
    }

    getGeneRIFCount(target) {
        //console.log('>>> getGeneRIFCount: '+target.tcrdid);
        return this.db.select(this.db.raw(`
count(*) as cnt from generif a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
    }

    getGeneRIFs(target, args) {
        //console.log('>>> getGeneRIFs: '+target.tcrdid+' '+args);
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
a.id as rifid, a.text
from generif a, t2tc b
where match(a.text) against(? in boolean mode) 
and a.protein_id = b.protein_id 
and b.target_id = ? limit ? offset ?`, [args.term, target.tcrdid,
                args.top, args.skip]));
        }

        return this.db.select(this.db.raw(`
a.id as rifid, a.text from generif a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? 
order by years desc, pubmed_ids desc limit ? offset ?`,
            [target.tcrdid,
                args.top, args.skip]));
    }

    getPubsForGeneRIF(generif) {
        //console.log('>>> getPubsForGeneRIF: '+generif.rifid);
        return this.db.select(this.db.raw(`
pubmed_ids from generif where id = ?`, [generif.rifid]))
            .then(rows => {
                let pubs = [];
                for (var i in rows) {
                    let toks = rows[i].pubmed_ids.split('|');
                    for (var j in toks) {
                        pubs.push(parseInt(toks[j]));
                    }
                }
                return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed`)).whereIn('id', pubs);
            });
    }

    getPPICountsForTarget(target) {
        //console.log('>>> getPPICount: '+target.tcrdid);
        return this.db.select(this.db.raw(`
a.ppitype as name, count(*) as value 
from ppi a, t2tc b
where a.protein1_id = b.protein_id
and b.target_id = ?
group by ppitype order by value desc`, [target.tcrdid]));
    }

    getPPIsForTarget(target, args) {
        //console.log('>>> getPPIs: '+target.tcrdid);
        const PPI_SQL = `
a.id as nid, ppitype as type, 
p_int, p_ni, p_wrong, evidence, interaction_type, a.score as score,
c.score as novelty, d.tdl as tdl, d.fam as fam, e.sym as sym
from ppi a, target d, protein e, t2tc b1, t2tc b2
left join tinx_novelty c use index(tinx_novelty_idx3)
on c.protein_id = b2.protein_id
`;
        let q;
        if (args.filter) {
            let filter = utils.parseFilterOrder(args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(PPI_SQL + `
left join tdl_info f on f.protein_id = b2.protein_id
and f.itype = ?`, [filter.order]));
            } else {
                q = this.db.select(this.db.raw(PPI_SQL));
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                if ('type' == f.facet)
                    f.facet = 'ppitype';
                q = q.whereIn(f.facet, f.values);
            }

            let sort = true;
            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(e.uniprot,e.sym,e.stringid) against(? in boolean mode) or 
match(e.name,e.description) against(? in boolean mode))`, [args.filter.term,
                    args.filter.term]));
                sort = false;
            }

            q = q.andWhere(this.db.raw(`
a.protein2_id = b2.protein_id
and a.protein1_id = b1.protein_id
and d.id = b2.target_id
and e.id = b2.protein_id
and b1.target_id = ?`, [target.tcrdid]));

            if (sort) {
                q = q.orderBy([{column: 'novelty', order: 'desc'},
                    {column: filter.sortColumn, order: filter.dir}]);
            }

            q = q.limit(args.top)
                .offset(args.skip);
        } else {
            q = this.db.select(this.db.raw(PPI_SQL + `
where a.protein2_id = b2.protein_id
and a.protein1_id = b1.protein_id
and d.id = b2.target_id
and e.id = b2.protein_id
and b1.target_id = ? order by c.score desc
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
        }
        //console.log('>>> getPPIsForTarget: '+q);
        return q;
    }

    getTargetForPPINeighbor(neighbor) {
        //console.log('>>> getTargetForNeighbor: '+neighbor.nid);
        return this.db.select(this.db.raw(`
a.*,b.uniprot,b.sym,b.seq,a.id as tcrdid, e.score as novelty, 
b.description as name, f.string_value as description
from target a, protein b, ppi d, t2tc c
left join tinx_novelty e use index(tinx_novelty_idx3)
on e.protein_id = c.protein_id
left join tdl_info f on f.protein_id = c.protein_id 
and f.itype = '${CONSTANTS.DESCRIPTION_TYPE}'
where a.id = c.target_id and b.id = c.protein_id
and b.id = d.protein2_id and d.id = ?`, [neighbor.nid]));
    }

    getPPIPropsForNeighbor(neighbor) {
        //console.log('>>> getPropsForNeighbor: '+neighbor.nid);
        return this.db.select(this.db.raw(`
* from ppi where id = ?`, [neighbor.nid]));
    }

    getDiseasesForTarget(target, args) {
        let q = this.db.select(this.db.raw(`
a.name,count(*) as associationCount
from disease a, t2tc b`));

        let sort = true;
        if (args.filter) {
            let sub = this.getDiseaseFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(a.name, a.description, a.drug_name) against(? in boolean mode)`, [t]));
                sort = false;
            }
        }

        q = q.andWhere(this.db.raw(`a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]))
            .groupBy('a.name')
            .orderBy('associationCount', 'desc');

        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getDiseasesForTarget: '+q);
        return q;
    }

    getGeneAttributesForTarget(target, args) {
        let q = this.db.select(this.db.raw(`
id as gaid, type as _type, attr_count as count, attr_cdf as cdf
from hgram_cdf a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
        return q;
    }

    getGeneAttributeTypeForGeneAttribute(ga, args) {
        let q = this.db.select(this.db.raw(`
*, id as gatid, resource_group as category, 
attribute_group as 'group', attribute_type as type
from gene_attribute_type
where name = ?`, [ga._type]));
        return q;
    }

    getGeneAttributeCountForTarget(target, args) {
        let q = this.db.select(this.db.raw(`count(*) as cnt
from hgram_cdf a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
        return q;
    }

    getGeneAttributeSummaryForTarget(target, args) {
        let p;
        switch (args.which) {
            case 'group':
                p = 'attribute_group';
                break;
            case 'category':
                p = 'resource_group';
                break;
            default:
                p = 'attribute_type';
        }

        let q = this.db.select(this.db.raw(p + ` as name,
avg(a.attr_cdf) as value
from hgram_cdf a, gene_attribute_type b, t2tc c
where a.protein_id = c.protein_id
and c.target_id = ?
and a.type = b.name
group by ` + p + ` order by name`, [target.tcrdid]));
        return q;
    }

    getGeneAttributeTypes() {
        return this.db.select(this.db.raw(`distinct attribute_type 
from gene_attribute_type order by attribute_type`));
    }

    getGeneAttributeGroups() {
        return this.db.select(this.db.raw(`distinct attribute_group 
from gene_attribute_type order by attribute_group`));
    }

    getGeneAttributeCategories() {
        return this.db.select(this.db.raw(`distinct resource_group 
from gene_attribute_type order by resource_group`));
    }

    getPubsForGeneAttributeType(gat, args) {
        let q;
        if (gat.pubmed_ids) {
            q = this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed`)).whereIn('id', gat.pubmed_ids.split('|'));
        } else {
            q = this.db.select(this.db.raw(`
pubmed_ids from gene_attribute_type where id = ?`, [gat.id]))
                .then(rows => {
                    let pubs = [];
                    for (var i in rows) {
                        let toks = rows[i].pubmed_ids.split('|');
                        for (var j in toks) {
                            pubs.push(parseInt(toks[j]));
                        }
                    }
                    return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed`)).whereIn('id', pubs);
                });
        }
        return q;
    }

    getOrthologDiseasesForOrtholog(ortho, args) {
        return this.db.select(this.db.raw(`
*,id as ordid from ortholog_disease 
where ortholog_id = ?`, [ortho.orid]));
    }

    getDiseasesForOrthologDisease(ortho, args) {
        return this.db.select(this.db.raw(`
a.name,count(*) as associationCount
from disease a, ortholog_disease b
where a.did = b.did
and b.id = ? 
group by a.name
order by associationCount desc, zscore desc`, [ortho.ordid]));
    }

    getTargetCountsForDiseaseAssociation(disease) {
        return this.db.select(this.db.raw(`
tdl as name, count(*) as value 
from target a, t2tc b, disease c
where a.id=b.target_id and c.protein_id=b.protein_id
and c.name = ? group by tdl
order by value desc`, [disease.name]));
    }

    getTargetsForDiseaseAssociation(disease, args) {
        const DISEASE_SQL = `
a.*,b.uniprot,b.sym,b.seq,e.score as novelty, a.id as tcrdid,
b.description as name, g.string_value as description
from target a, protein b, disease d, t2tc c
left join tinx_novelty e use index(tinx_novelty_idx3)
on e.protein_id = c.protein_id
left join tdl_info g on g.protein_id = c.protein_id and
g.itype = '${CONSTANTS.DESCRIPTION_TYPE}'`;
        let q;
        if (args.filter) {
            let filter = utils.parseFilterOrder(args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(DISEASE_SQL + `
left join tdl_info f on f.protein_id = c.protein_id
and f.itype = ?`, [filter.order]));
            } else {
                q = this.db.select(this.db.raw(DISEASE_SQL));
            }

            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let sort = true;
            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode) or 
match(b.name,b.description) against(? in boolean mode))`, [args.filter.term,
                    args.filter.term]));
                sort = false;
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id
and d.protein_id = c.protein_id
and d.name = ?`, [disease.name]));
            if (sort) {
                q = q.orderBy(filter.sortColumn, filter.dir);
            }

            q = q.limit(args.top)
                .offset(args.skip);
        } else {
            q = this.db.select(this.db.raw(DISEASE_SQL + `
where a.id = c.target_id and b.id = c.protein_id
and d.protein_id = c.protein_id
and d.name = ? order by e.score desc
limit ? offset ?`, [disease.name, args.top, args.skip]));
        }
        //console.log('>>> getTargetsForDisease: '+q);
        return q;
    }

    getPatentCounts(target, args) {
        return this.db.select(this.db.raw(`
* from patent_count a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? order by year`, [target.tcrdid]));
    }

    getPubTatorScores(target, args) {
        return this.db.select(this.db.raw(`
year,sum(score) as score 
from ptscore a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?
group by year order by year`, [target.tcrdid]));
    }

    getPubMedScores(target, args) {
        return this.db.select(this.db.raw(`
* from pmscore a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? order by year`, [target.tcrdid]));
    }

    getPanther(target) {
        return this.db.select(this.db.raw(`
* from p2pc a, panther_class b, t2tc c
where a.panther_class_id = b.id
and a.protein_id = c.protein_id
and c.target_id = ?
order by pcid desc`, [target.tcrdid]));
    }

    getPathwayCounts(target) {
        return this.db.select(this.db.raw(`
pwtype as name, count(*) as value
from pathway a, t2tc b 
where a.protein_id = b.protein_id
and b.target_id = ? 
group by pwtype
order by value desc`, [target.tcrdid]));
    }

    getTargetCountsForPathway(pathway) {
        return this.db.select(this.db.raw(`
a.tdl as name, count(*) as value
from target a, t2tc b, pathway c
where a.id = b.target_id and c.protein_id = b.protein_id
and c.pwtype = ? and c.name = ?
group by a.tdl
order by value desc`, [pathway.type, pathway.name]));
    }

    getTargetCountsForPubMed(pubmed) {
        return this.db.select(this.db.raw(`
a.tdl as name, count(*) as value
from target a, t2tc b, protein2pubmed c
where a.id = b.target_id and c.protein_id = b.protein_id
and c.pubmed_id = ?
group by a.tdl
order by value desc`, [pubmed.pmid]));
    }

    getTargetsForPubMed(pubmed, args) {
        const PUBMED_SQL = `
a.*,b.uniprot,b.sym,b.seq,e.score as novelty, a.id as tcrdid,
b.description as name, g.string_value as description
from target a, protein b, protein2pubmed f, t2tc c
left join tinx_novelty e use index(tinx_novelty_idx3)
on e.protein_id = c.protein_id
left join tdl_info g on g.protein_id = c.protein_id and 
g.itype = '${CONSTANTS.DESCRIPTION_TYPE}'
`;
        let q;
        if (args.filter) {
            let filter = utils.parseFilterOrder(args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(PUBMED_SQL + `
left join tdl_info d on d.protein_id = c.protein_id
and d.itype = ?`, [filter.order]));
            } else {
                q = this.db.select(this.db.raw(PUBMED_SQL));
            }

            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let sort = true;
            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode) or 
match(b.name,b.description) against(? in boolean mode))`, [args.filter.term,
                    args.filter.term]));
                sort = false;
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pubmed_id = ?`, [pubmed.pmid]));
            if (sort) {
                q = q.orderBy(filter.sortColumn, filter.dir);
            }
            q = q.limit(args.top)
                .offset(args.skip);
        } else {
            q = this.db.select(this.db.raw(PUBMED_SQL + `
where a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pubmed_id = ? 
order by novelty desc
limit ? offset ?`, [pubmed.pmid, args.top, args.skip]));
        }

        //console.log('>>> getTargetsForPubMed: '+q);
        return q;
    }

    getPathways(target, args) {
        if (args.type.length > 0) {
            return this.db.select(this.db.raw(`
a.*, a.id as pwid, a.pwtype as type 
from pathway a, t2tc b`)).whereIn('a.pwtype', args.type)
                .andWhere(this.db.raw(`
a.protein_id = b.protein_id and b.target_id = ?
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
        }
        return this.db.select(this.db.raw(`
a.*, a.id as pwid, a.pwtype as type 
from pathway a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
    }

    getTargetsForPathway(pathway, args) {
        const PATHWAY_SQL = `
a.*,b.uniprot,b.sym,b.seq,e.score as novelty, a.id as tcrdid,
b.description as name, g.string_value as description
from target a, protein b, pathway f, t2tc c
left join tinx_novelty e use index(tinx_novelty_idx3)
on e.protein_id = c.protein_id
left join tdl_info g on g.protein_id = c.protein_id 
and g.itype = '${CONSTANTS.DESCRIPTION_TYPE}'`;
        let q;
        if (args.filter) {
            let filter = utils.parseFilterOrder(args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(PATHWAY_SQL + `
left join tdl_info f on f.protein_id = c.protein_id
and f.itype = ?`, [filter.order]));
            } else {
                q = this.db.select(this.db.raw(PATHWAY_SQL));
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.facet, f.values);
            }

            let sort = true;
            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode) or 
match(b.name,b.description) against(? in boolean mode))`, [args.filter.term,
                    args.filter.term]));
                sort = false;
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pwtype = ? and f.name = ?`, [pathway.type, pathway.name]));
            if (sort) {
                q = q.orderBy(filter.sortColumn, filter.dir);
            }
            q = q.limit(args.top)
                .offset(args.skip);
        } else {
            q = this.db.select(this.db.raw(PATHWAY_SQL + `
where a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pwtype = ? and f.name = ?
order by novelty desc
limit ? offset ?`, [pathway.type, pathway.name, args.top, args.skip]));
        }

        //console.log('>>> getTargetsForPathway: '+q);
        return q;
    }

    getLocSigsForTarget(target) {
        return this.db.column({locid: 'id'}, 'location', 'signal')
            .select().from(this.db.raw(`locsig a, t2tc b`))
            .where(this.db.raw(`
a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
    }

    getPubsForLocSig(locsig) {
        return this.db.select(this.db.raw(`
pmids from locsig where id = ?`, [locsig.locid]))
            .then(rows => {
                let pubs = [];
                for (var i in rows) {
                    let toks = rows[i].pmids.split('|');
                    //console.log(locsig.locid+' => '+toks);
                    for (var j in toks) {
                        pubs.push(parseInt(toks[j]));
                    }
                }
                return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed`)).whereIn('id', pubs);
            });
    }

    getLINCSCountsForTarget(target) {
        return this.db.select(this.db.raw(`
cellid as name, count(*) as value
from lincs a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? group by cellid
order by value desc`, [target.tcrdid]));
    }

    getLINCSForTarget(target, args) {
        if (args.cellid.length > 0) {
            return this.db.select(this.db.raw(`
id as lncsid, cellid, zscore, pert_smiles as smiles
from lincs a, t2tc b`)).whereIn('cellid', args.cellid)
                .andWhere(this.db.raw(`
a.protein_id = b.protein_id
and b.target_id = ? order by zscore
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
        }
        return this.db.select(this.db.raw(`
id as lncsid, cellid, zscore, pert_smiles as smiles
from lincs a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? order by zscore
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
    }

    getKeggDistancesForTarget(target, args) {
        const KEGG_SQL = `
a.id as nid, 'KEGG' as type, distance, 
c.score as novelty, d.tdl as tdl, d.fam as fam, e.sym as sym
from t2tc b1, t2tc b2, target d, protein e, kegg_distance a
left join tinx_novelty c use index(tinx_novelty_idx3) on c.protein_id = a.pid2
`;
        let q;
        if (args.filter) {
            let filter = utils.parseFilterOrder(args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(KEGG_SQL + `
left join tdl_info f on f.protein_id = a.pid2 
and f.itype = ?`, [filter.order]));
            } else {
                q = this.db.select(this.db.raw(KEGG_SQL));
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.facet, f.values);
            }

            let sort = true;
            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(e.uniprot,e.sym,e.stringid) against(? in boolean mode) or 
match(e.name,e.description) against(? in boolean mode))`, [args.filter.term,
                    args.filter.term]));
                sort = false;
            }

            q = q.andWhere(this.db.raw(`
a.pid1 = b1.protein_id and a.pid2 = e.id
and a.pid2 = b2.protein_id and d.id = b2.target_id
and b1.target_id = ?`, [target.tcrdid]));
            if (sort) {
                q = q.orderBy([{column: 'distance', order: 'asc'},
                    {column: filter.sortColumn, order: filter.dir}]);
            }
            q = q.limit(args.top)
                .offset(args.skip);
        } else {
            q = this.db.select(this.db.raw(KEGG_SQL + `
where a.pid1 = b1.protein_id
and a.pid2 = e.id
and a.pid2 = b2.protein_id
and d.id = b2.target_id
and b1.target_id = ? order by distance, c.score desc
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
        }
        return q;
    }

    getTargetForKeggNeighbor(neighbor) {
        return this.db.select(this.db.raw(`
a.*,b.uniprot,b.sym,b.seq,a.id as tcrdid, e.score as novelty,
b.description as name, f.string_value as description
from target a, protein b, kegg_distance d, t2tc c
left join tinx_novelty e use index(tinx_novelty_idx3)
on e.protein_id = c.protein_id
left join tdl_info f on f.protein_id = c.protein_id 
and f.itype = '${CONSTANTS.DESCRIPTION_TYPE}'
where a.id = c.target_id and b.id = c.protein_id
and b.id = d.pid2 and d.id = ?`, [neighbor.nid]));
    }

    getExpressionCountsForTarget(target) {
        return this.db.select(this.db.raw(`
etype as name, count(*) as value
from expression a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?
group by etype order by value desc`, [target.tcrdid]));
    }

    getExpressionsForTarget(target, args) {
        const EXPRESSION_SQL = `
d.*,f.*, d.id as expid, d.etype as type, 
d.cell_id as cellid, d.oid as btoid
from t2tc c, expression d 
left join uberon f on f.uid = d.uberon_id`;
        let q = this.db.select(this.db.raw(EXPRESSION_SQL));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                if ('type' == f.facet)
                    f.facet = 'etype';
                q = q.whereIn(f.facet, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
match(d.tissue) against(? in boolean mode)`, [args.filter.term]));
            }
        }

        q = q.andWhere(this.db.raw(`            
d.protein_id = c.protein_id
and c.target_id = ?`, [target.tcrdid]))
            .limit(args.top)
            .offset(args.skip);

        //console.log('>>> getExpressionForTarget: '+q);
        return q;
    }

    getOrthologSpeciesCounts(args) {
        let q = this.db.select(this.db.raw(`
species as name, count(*) as value
from ortholog`));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.facet, f.values);
            }

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(symbol,name) against(? in boolean mode)`, [t]));
            }
        }

        q = q.groupBy('name')
            .orderBy('value', 'desc');

        //console.log('>>> getOrthologSpeciesCounts: '+q);
        return q;
    }

    getOrthologTDLCounts(args) {
        let q = this.db.select(this.db.raw(`
a.tdl as name, count(*) as value
from target a, ortholog b, t2tc c
`));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.facet, f.values);
            }

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
match(b.symbol, b.name) against(? in boolean mode)`, [t]));
            }
        }

        q = q.andWhere(this.db.raw(`a.id = c.target_id
and b.protein_id = c.protein_id`))
            .groupBy('a.tdl')
            .orderBy('value', 'desc');

        //console.log('>>> getOrthologTDLCounts: '+q);
        return q;
    }

    getOrthologCounts() {
        return this.db.select(this.db.raw(`
species as name, count(*) as value
from ortholog 
group by species
order by value desc`));
    }

    getOrthologs(args) {
        let q = this.db.select(this.db.raw(`
*, id as orid, db_id as dbid, symbol as sym
from ortholog`));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.facet, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
match(symbol,name) against(? in boolean mode)`, [args.filter.term]));
            }
        }

        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getOrthologs: '+q);
        return q;
    }

    getOrthologCountsForTarget(target) {
        return this.db.select(this.db.raw(`
species as name, count(*) as value
from ortholog a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? group by species
order by value desc`, [target.tcrdid]));
    }

    getOrthologsForTarget(target, args) {
        const ORTHOLOG_SQL = `
a.*,db_id as dbid,a.id as orid, a.symbol as sym, c.score as score
from t2tc b, ortholog a
left join ortholog_disease c on c.ortholog_id = a.id`;
        let q = this.db.select(this.db.raw(ORTHOLOG_SQL));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.facet, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
match(a.symbol,a.name) against(? in boolean mode)`, [args.filter.term]));
            }
        }

        q = q.andWhere(this.db.raw(`
a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));

        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getOrthologCountsForTarget: '+q);
        return q;
    }

    getGWASCountsForTarget(target) {
        return this.db.select(this.db.raw(`
disease_trait as name, count(distinct b.protein_id) as value
from gwas a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? group by disease_trait
order by value desc`, [target.tcrdid]));
    }

    getGWASForTarget(target, args) {
        let q = this.db.select(this.db.raw(`
a.*, a.id as gwasid, a.p_value as pvalue, 
a.disease_trait as trait, snps as _snps
from gwas a, t2tc b`));

        let sort = true;
        if (args.filter) {
            for (var i in args.filter.frange) {
                let f = args.filter.frange[i];
                if ('pvalue' == f.facet) {
                    f.facet = 'p_value';
                    if (f.start && f.end) {
                        q = q.andWhere(this.db.raw(`? >= ? and ? < ?`, [f.facet, f.start, f.facet, f.end]));
                    } else if (f.start) {
                        q = q.andWhere(this.db.raw(`? >= ?`, [f.facet, f.start]));
                    } else {
                        q = q.andWhere(this.db.raw(`? < ?`, [f.facet, f.end]));
                    }
                }
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                if ('trait' == f.facet)
                    f.facet = 'disease_trait';
                q = q.whereIn(f.facet, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(disease_trait,mapped_trait,study) against(? in boolean mode)
or match(snps) against(? in boolean mode))`, [args.filter.term,
                    args.filter.term]));
                sort = false;
            }
        }

        q = q.andWhere(this.db.raw(`
a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));

        if (sort)
            q = q.orderBy('p_value', 'asc');

        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getGWASForTarget: '+q);
        return q;
    }

    getLigandDrugCounts(args, table) {
        let q;
        if (args.filter) {
            q = this.db.select(this.db.raw(`
count(distinct lychi_h4) as cnt
from ${table} a`));
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                switch (f.facet) {
                    case 'type': // do nothing
                        break;
                    case 'activity':
                        q = q.whereIn('act_type', f.values);
                        break;
                }
            }

            let idcolumn;
            if (table == 'cmpd_activity') {
                q = q.whereNotExists(builder =>
                    builder.select('*').from('drug_activity')
                        .whereRaw('lychi_h4=a.lychi_h4'))
                    .andWhere(this.db.raw(`lychi_h4 is not null`));
                idcolumn = 'cmpd_id_in_src';
            } else {
                idcolumn = 'drug';
            }

            let p = this.db.select(this.db.raw(`
count(distinct ${idcolumn}) as cnt
from ${table}`));
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                switch (f.facet) {
                    case 'type': // do nothing
                        break;
                    case 'activity':
                        p = p.whereIn('act_type', f.values);
                        break;
                }
            }
            p = p.andWhere(this.db.raw(`lychi_h4 is null`));
            q = q.union(p);
        } else {
            let sql = `count(distinct lychi_h4) as cnt
from ${table} a where `;
            let idcolumn;
            if (table == 'cmpd_activity') {
                sql += `not exists (select 1 from drug_activity 
where lychi_h4=a.lychi_h4) and `;
                idcolumn = 'cmpd_id_in_src';
            } else {
                idcolumn = 'drug';
            }
            sql += `lychi_h4 is not null
union select count(distinct ${idcolumn}) as cnt
from ${table} where lychi_h4 is null`;
            q = this.db.select(this.db.raw(sql));
        }

        //console.log('>>> getLigandDrugCounts: '+q);

        return q;
    }

    getLigandCounts(args) {
        return this.getLigandDrugCounts(args, 'cmpd_activity');
    }

    getDrugCounts(args) {
        return this.getLigandDrugCounts(args, 'drug_activity');
    }

    getLigandLabels(args) {
        let q = this.db.select(this.db.raw(`* from ncats_ligand_labels a`));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                switch (f.facet) {
                    case 'type':
                        for (var j in f.values) {
                            switch (f.values[j]) {
                                case 'drug':
                                case 'Drug':
                                    q = q.andWhere(this.db.raw(`
exists (select 1 from drug_activity where lychi_h4 = a.label)
or exists (select 1 from drug_activity where drug = a.label)`));
                                    break;
                                case 'ligand':
                                case 'Ligand':
                                    q = q.andWhere(this.db.raw(`
exists (select 1 from cmpd_activity where lychi_h4 = a.label)
or exists (select 1 from cmpd_activity where  cmpd_id_in_src = a.label)`));
                                    break;
                            }
                        }
                        break;

                    case 'activity':
                        q = q.whereExists(builder =>
                            builder.select('*').from('drug_activity')
                                .whereIn('act_type', f.values)
                                .andWhereRaw(`lychi_h4=a.label`))
                            .orWhereExists(builder =>
                                builder.select('*')
                                    .from('cmpd_activity')
                                    .whereIn('act_type', f.values)
                                    .andWhereRaw(`lychi_h4=a.label`));
                        break;
                }
            }
        }

        q = q.orderByRaw(this.db.raw(`count desc, label`));
        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);

        //console.log('>>> getLigandLabels: '+q);
        return q;
    }

    getLigand(id) {
        let q = this.db.select(this.db.raw(`
catype,cmpd_id_in_src,cmpd_name_in_src,cmpd_pubchem_cid,smiles,lychi_h4
from cmpd_activity`))
            .where('lychi_h4', id)
            .orWhere('cmpd_id_in_src', id);
        return q;
    }

    getDrug(id) {
        let q = this.db.select(this.db.raw(`
drug, cmpd_chemblid, nlm_drug_info, cmpd_pubchem_cid, dcid,smiles,lychi_h4
from drug_activity`))
            .where('lychi_h4', id)
            .orWhere('drug', id);
        return q;
    }

    __getLigandLabels(args) {
        let q = this.db.select(this.db.raw(`
label,sum(cnt) as cnt from (
  select lychi_h4 as label,count(*) as cnt 
  from drug_activity where lychi_h4 is not null 
  group by lychi_h4 
  union 
  select drug as label,count(*) as cnt
  from drug_activity where lychi_h4 is null
  group by drug
  union
  select lychi_h4 as label,count(*) as cnt 
  from cmpd_activity where lychi_h4 is not null 
  group by lychi_h4
  union
  select cmpd_id_in_src as label,count(*) as cnt
  from cmpd_activity where lychi_h4 is null
  group by cmpd_id_in_src
) a group by label order by cnt desc, label`));
        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);
        //console.log('>>> getLigandLabels: '+q);
        return q;
    }

    getActivityCounts(args) {
        let q = this.db.select(this.db.raw(`
act_type,count(distinct lychi_h4) as cnt from drug_activity 
where act_type not in ('','-') and lychi_h4 is not null
group by act_type
union select act_type,count(distinct drug) as cnt from drug_activity 
where act_type not in ('','-') and lychi_h4 is null
group by act_type
union select act_type,count(distinct lychi_h4) as cnt from cmpd_activity 
where act_type not in ('','-') and lychi_h4 is not null
group by act_type
union select act_type,count(distinct cmpd_id_in_src) as cnt
from cmpd_activity where act_type not in ('','-') and lychi_h4 is null
group by act_type`));
        return q;
    }

    getLigandCountForTarget(target) {
        return this.db.select(this.db.raw(`
count(distinct lychi_h4) as cnt 
from cmpd_activity a
where target_id = ?
and lychi_h4 is not null
union select count(distinct cmpd_id_in_src) as cnt
from cmpd_activity where target_id = ?
and lychi_h4 is null`, [target.tcrdid, target.tcrdid]));
    }

    getDrugCountForTarget(target) {
        return this.db.select(this.db.raw(`
count(distinct lychi_h4) as cnt
from drug_activity
where target_id = ?
and lychi_h4 is not null union
select count(distinct drug) as cnt
from drug_activity
where target_id = ?
and lychi_h4 is null`, [target.tcrdid, target.tcrdid]));
    }

    getLigandLabelsForTarget(target) {
        let q = this.db.select(this.db.raw(`
lychi_h4 as label,count(*) as cnt 
from cmpd_activity where lychi_h4 is not null and target_id = ? 
group by lychi_h4 
union 
select cmpd_id_in_src as label,count(*) as cnt 
from cmpd_activity where lychi_h4 is null and target_id = ? 
group by cmpd_id_in_src
order by cnt desc`, [target.tcrdid, target.tcrdid]));
        //console.log('~~~~~~~~~ getLigandLabelsForTarget: '+q);
        return q;
    }

    getDrugLabelsForTarget(target) {
        let q = this.db.select(this.db.raw(`
lychi_h4 as label,count(*) as cnt
from drug_activity
where lychi_h4 is not null
and target_id = ?
group by lychi_h4
union select drug as label, count(*) as cnt
from drug_activity
where lychi_h4 is null
and target_id = ?
group by drug
order by cnt desc`, [target.tcrdid, target.tcrdid]));
        //console.log('~~~~~~~~~ getDrugLabelsForTarget: '+q);        
        return q;
    }

    getLigandsForLabels(labels,args) {
        return this.getLigandsForTarget(null, args, labels);
    }

    getLigandsForTarget(target, args, labels) {
        let q = this.db.select(this.db.raw(`
    catype,avg(act_value) as potency,cmpd_id_in_src,cmpd_name_in_src,cmpd_pubchem_cid,smiles,lychi_h4,
    ifnull(lychi_h4,cmpd_id_in_src) as identifier
    from cmpd_activity`));
        q = q.whereIn('lychi_h4', labels)
            .orWhereIn('cmpd_id_in_src', labels)
            .groupBy('identifier')
            .orderBy('potency', 'desc');
        if(!!target) {
            q = q.andWhere(this.db.raw(`target_id = ?`, [target.tcrdid]));
            if (args.top)
                q = q.limit(args.top);
            if (args.skip)
                q = q.offset(args.skip);
        }
        //console.log("getLigandsForTarget : " + q);
        return q;
    }

    getDrugsForLabels(labels,args) {
        return this.getDrugsForTarget(null, args, labels);
    }

    getDrugsForTarget(target, args, labels) {
        let q = this.db.select(this.db.raw(`
    drug, avg(act_value) as potency, cmpd_chemblid, nlm_drug_info, cmpd_pubchem_cid, dcid,smiles,lychi_h4,
    ifnull(lychi_h4,drug) as identifier
    from drug_activity`));
        q = q.whereIn('lychi_h4', labels)
            .orWhereIn('drug', labels)
            .groupBy('identifier')
            .orderBy('potency', 'desc');
        if(!!target) {
            q = q.where(this.db.raw(`target_id = ?`, [target.tcrdid]));
            if (args.top)
                q = q.limit(args.top);
            if (args.skip)
                q = q.offset(args.skip);
        }
        //console.log('getDrugsForTarget : ' +q);
        return q;
    }

    getLigandActivities(ligand, args) {
        let q = this.db.select(this.db.raw(`
id, act_value,act_type,target_id from cmpd_activity`));
        if (args.all == false && ligand.parent) {
            q = q.andWhere(this.db.raw(`target_id = ?`,
                [ligand.parent.tcrdid]));
        }
        q = q.andWhere(this.db.raw(`
lychi_h4 = ? or cmpd_id_in_src = ?`, [ligand.ligid, ligand.ligid]));
        return q;
    }

    getDrugActivities(ligand, args) {
        let q = this.db.select(this.db.raw(`
id, act_value, act_type, action_type, target_id from drug_activity`));
        if (args.all == false && ligand.parent) {
            q = q.andWhere(this.db.raw(`target_id = ?`,
                [ligand.parent.tcrdid]));
        }
        q = q.andWhere(this.db.raw(`
lychi_h4 = ? or drug = ?`, [ligand.ligid, ligand.ligid]));
        return q;
    }

    getDOHierarchy() {
        let q = this.db.select(this.db.raw(`
a.*,b.parent_id from do a, do_parent b where a.doid = b.doid`));
        return q;
    }

    getDiseaseOntology(args) {
        let matches = [];
        for (var n in this.doTree) {
            let node = this.doTree[n];
            if (node.parents.length == 0) {
                diseaseOntologyTraversal(matches, node, args);
            }
        }
        return matches;
    }

    getDTOHierarchy() {
        return this.db.select(this.db.raw(`* from dto`));
    }

    getDTO(args) {
        let matches = [];
        if (args.dtoid) {
            let n = this.dto[args.dtoid];
            while (n) {
                matches.push(n);
                n = n.parent;
            }
        } else {
            for (var key in this.dto) {
                let n = this.dto[key];
                if (!n.parent)
                    dtoTraversal(matches, n, args);
            }
        }
        return matches;
    }

    getTINXCountForTarget(target) {
        let q = this.db.select(this.db.raw(`
count(*) as cnt
from tinx_importance a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
        return q;
    }

    getTINXForTarget(target, args) {
        let q = this.db.select(this.db.raw(`
a.*,b.doid, b.score as novelty, a.id as tinxid
from tinx_importance a, tinx_disease b, t2tc c`));

        let sort = true;
        if (args.filter) {
            let t = args.filter.term;
            if (t != undefined && t != '') {
                q = q.andWhere(this.db.raw(`
match(b.name,b.summary) against(? in boolean mode)`, [t]));
                sort = false;
            }
        }
        q = q.andWhere(this.db.raw(`a.disease_id = b.id
and a.protein_id = c.protein_id
and c.target_id = ?`, [target.tcrdid]));

        q = q.limit(args.top)
            .offset(args.skip);
        if (sort) {
            q = q.orderBy('b.score', 'desc');
        }

        return q;
    }

    getSuggestions(key) {
        let firstWordMatch = key + '%';
        let laterWordMatch = '% ' + key + '%';
        let q = this.db.select(this.db.raw(`
* from (
    select 
        value, source 
    from ncats_typeahead 
    where source = 'UniProt Gene'
        and value like ?
    limit 10
) as genes
union select * from (
    select 
        value, source 
    from ncats_typeahead 
    where source = 'Target'
        and value like ?
    union select 
        value, source 
    from ncats_typeahead 
    where source = 'Target'
        and value like ?
    limit 10
) as targets
union select * from (
    select 
        value, source 
    from ncats_typeahead 
    where source = 'Disease'
        and value like ?
    union select 
        value, source 
    from ncats_typeahead 
    where source = 'Disease'
        and value like ?
    limit 10
) as diseases
union select * from (
    select 
        value, source 
    from ncats_typeahead 
    where source = 'IMPC Phenotype'
        and value like ?
    union select 
        value, source 
    from ncats_typeahead 
    where source = 'IMPC Phenotype'
        and value like ?
    limit 10
) as phenotypes
union select * from (
    select 
        value, source 
    from ncats_typeahead 
    where source = 'UniProt Keyword'
        and value like ?
    union select 
        value, source 
    from ncats_typeahead 
    where source = 'UniProt Keyword'
        and value like ?
    limit 10
) as keywords`, [firstWordMatch, firstWordMatch, laterWordMatch, firstWordMatch, laterWordMatch, firstWordMatch, laterWordMatch, firstWordMatch, laterWordMatch]));
        return q;
    }

}
Object.assign(TCRD.prototype, require('./facet_search'));
Object.assign(TCRD.prototype, require('./target_search'));

module.exports = TCRD;
