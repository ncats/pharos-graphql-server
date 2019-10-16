const { SQLDataSource } = require("datasource-sql");

const MINUTE = 60;

const TARGET_SQL = `
a.*,b.*,e.score as novelty, a.id as tcrdid 
from target a, protein b, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
where a.id = c.target_id and b.id = c.protein_id
`;

function parseFilter (filter) {
    let order = filter.order;
    let sortColumn = 'novelty';
    let dir = 'desc';
    
    if (order) {
        let ch = order.charAt(0);
        if (ch == '^' || ch == '!') {
            order = order.substring(1);
            if (ch == '^') dir = 'asc';
        }
        
        switch (order) {
        case 'Ab Count':
        case 'MAb Count':
        case 'NCBI Gene PubMed Count':
        case 'EBI Total Patent Count':
        case 'ChEMBL First Reference Year':
            sortColumn = 'integer_value';
            break;
            
        case 'JensenLab PubMed Score':
        case 'PubTator Score':
            sortColumn = 'number_value';
            break;
        }
    }
    return {'order': order,
            'sortColumn': sortColumn,
            'dir': dir};
}

class TCRD extends SQLDataSource {
    getTarget (args) {
        //console.log('>>> getTarget: '+JSON.stringify(args));
        if (args.uniprot || args.sym || args.stringid) {
            var value;
            if (args.uniprot) value = args.uniprot;
            else if (args.sym) value = args.sym;
            else value = args.stringid;
            return this.db.select(this.db.raw(TARGET_SQL+`
and match(b.uniprot,b.sym,b.stringid) against(?)`, [value]));
        }
        
        if (args.geneid) {
            return this.db.select(this.db.raw(TARGET_SQL+`
and b.geneid=?`, [args.geneid]));
        }
        
        return this.db.select(this.db.raw(TARGET_SQL+`
and a.id = ?`, [args.tcrdid]));
    }
    
    getTargets (args) {
        //console.log('>>> getTargets: '+JSON.stringify(args));
        let q = undefined;
        if (args.filter) {
            let filter = parseFilter (args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(`
a.*,b.*,e.score as novelty, a.id as tcrdid 
from target a, protein b, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info d 
on c.protein_id = d.protein_id and d.itype = ?`, [filter.order]));
            }
            else {
                q = this.db.select(this.db.raw(`
a.*,b.*,e.score as novelty, a.id as tcrdid 
from target a, protein b, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id`));
            }
            
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.name, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(?) or 
match(b.name,b.description) against(?))`, [args.filter.term, args.filter.term]));
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id`))
                .orderBy(filter.sortColumn, filter.dir)
                .limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(TARGET_SQL+`
order by novelty desc limit ? offset ?`, [args.top, args.skip]));
        }
        //console.log('>>> '+q);
        
        return q;
    }

    getDiseases (args) {
        let q = this.db.select(this.db.raw(`
*,id as disid, dtype as type, drug_name as drug
from disease`));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                if ('type' == f.name)
                    f.name = 'dtype';
                q = q.whereIn(f.name, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
match(name, description, drug_name) against(?)`, [args.filter.term]));
            }
        }

        if (args.top)
            q = q.limit(args.top);
        
        if (args.skip)
            q = q.offset(args.skip);
        
        console.log('>>> getDiseases: '+q);
        return q;
    }

    getPub (pmid) {
        return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed where id = ?`, [pmid]));
    }
    
    getPubCount (args) {
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
count(*) as cnt from pubmed 
where match(title,abstract) against(?)`, [args.term]));
        }
        return this.db.select(this.db.raw(`
count(*) as cnt from pubmed`));
    }
    
    getPubs (args) {
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed where match(title,abstract) against(?) 
order by date desc, pmid desc
limit ? offset ?`, [args.term, args.top, args.skip]));
        }
        return this.db.select(this.db.raw(`
id as pmid, title, journal, date, abstract
from pubmed order by date desc, pmid desc 
limit ? offset ?`, [args.top, args.skip]));
    }
    
    getXrefsForTarget (target) {
        //console.log('>>> getXrefsForTarget: '+target.tcrdid);
        return this.db.select(this.db.raw(`
xtype as source, value 
from xref where protein_id = ?`, [target.tcrdid]));
    }

    getProps (target) {
        //console.log('>>> getProps: '+target.tcrdid);
        return this.db.select(this.db.raw(`
a.* from tdl_info a, t2tc b
where b.target_id = ? and a.protein_id = b.protein_id`, [target.tcrdid]));
    }

    getTargetsForXref (xref) {
        //console.log('>>> getTargetForXref: '+JSON.stringify(xref));
        return this.db.select(this.db.raw(`
a.*,b.*,a.id as tcrdid from target a, protein b, t2tc c, xref d
where a.id = c.target_id and b.id = c.protein_id
and b.id = d.protein_id and d.xtype = ? and d.value = ?
`, [xref.source, xref.value]));
    }

    getXref (args) {
        //console.log('>>> getXref: '+JSON.stringify(args));
        return this.db.select(this.db.raw(`
xtype as source, value 
from xref where xtype = ? and value = ?`, [args.source, args.value]));
    }

    getPubCountForTarget (target) {
        //console.log('>>> getPubCount: '+target.tcrdid);
        return this.db.select(this.db.raw(`
count(distinct a.id) as cnt
from pubmed a, protein2pubmed b, t2tc c 
where a.id = b.pubmed_id and b.protein_id = c.protein_id 
and c.target_id = ?`, [target.tcrdid]));
    }
    
    getPubsForTarget (target, args) {
        //console.log('>>> getPubs: '+target.tcrdid+' '+args);
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
a.id as pmid, title, journal, date, abstract
from pubmed a, protein2pubmed b, t2tc c 
where match(a.title,a.abstract) against(?) 
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

    getGeneRIFCount (target) {
        //console.log('>>> getGeneRIFCount: '+target.tcrdid);
        return this.db.select(this.db.raw(`
count(*) as cnt from generif a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
    }

    getGeneRIFs (target, args) {
        //console.log('>>> getGeneRIFs: '+target.tcrdid+' '+args);
        if (args.term !== '') {
            return this.db.select(this.db.raw(`
a.id as rifid, a.text
from generif a, t2tc b
where match(a.text) against(?) 
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

    getPubsForGeneRIF (generif) {
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

    getPPICountsForTarget (target) {
        //console.log('>>> getPPICount: '+target.tcrdid);
        return this.db.select(this.db.raw(`
a.ppitype as name, count(*) as value 
from ppi a, t2tc b
where a.protein1_id = b.protein_id
and b.target_id = ?
group by ppitype order by value desc`, [target.tcrdid]));
    }

    getPPIsForTarget (target, args) {
        //console.log('>>> getPPIs: '+target.tcrdid);
        const PPI_SQL = `
a.id as nid, ppitype as type, 
p_int, p_ni, p_wrong, evidence, interaction_type, a.score as score,
c.score as novelty, d.tdl as tdl, d.fam as fam, e.sym as sym
from ppi a, target d, protein e, t2tc b1, t2tc b2
left join tinx_novelty c on c.protein_id = b2.protein_id
`;
        let q;
        if (args.filter) {
            let filter = parseFilter (args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(PPI_SQL+`
left join tdl_info f on f.protein_id = b2.protein_id
and f.itype = ?`, [filter.order]));
            }
            else {
                q = this.db.select(this.db.raw(PPI_SQL));
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                if ('type' == f.name)
                    f.name = 'ppitype';
                q = q.whereIn(f.name, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(e.uniprot,e.sym,e.stringid) against(?) or 
match(e.name,e.description) against(?))`, [args.filter.term,
                                           args.filter.term]));
            }

            q = q.andWhere(this.db.raw(`
a.protein2_id = b2.protein_id
and a.protein1_id = b1.protein_id
and d.id = b2.target_id
and e.id = b2.protein_id
and b1.target_id = ?`, [target.tcrdid]))
                .orderBy([{column: 'novelty', order: 'desc'},
                          {column: filter.sortColumn, order: filter.dir}])
                .limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(PPI_SQL+`
where a.protein2_id = b2.protein_id
and a.protein1_id = b1.protein_id
and d.id = b2.target_id
and e.id = b2.protein_id
and b1.target_id = ? order by c.score desc
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
        }
        console.log('>>> getPPIsForTarget: '+q);
        return q;
    }

    getTargetForPPINeighbor (neighbor) {
        //console.log('>>> getTargetForNeighbor: '+neighbor.nid);
        return this.db.select(this.db.raw(`
a.*,b.*,a.id as tcrdid, e.score as novelty 
from target a, protein b, ppi d, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
where a.id = c.target_id and b.id = c.protein_id
and b.id = d.protein2_id and d.id = ?`, [neighbor.nid]));
    }

    getPPIPropsForNeighbor (neighbor) {
        console.log('>>> getPropsForNeighbor: '+neighbor.nid);
        return this.db.select(this.db.raw(`
* from ppi where id = ?`, [neighbor.nid]));
    }

    getDiseaseCountsForTarget (target) {
        return this.db.select(this.db.raw(`
dtype as name, count(*) as value
from disease a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?
group by dtype 
order by value desc`, [target.tcrdid]));
    }

    getDiseasesForTarget (target, args) {
        if (args.type.length > 0) {
            return this.db.select(this.db.raw(`
a.*,a.id as disid, a.dtype as type, drug_name as drug
from disease a, t2tc b`)).whereIn('dtype', args.type)
                .andWhere(this.db.raw(`
a.protein_id = b.protein_id
and b.target_id = ? order by zscore desc
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
        }
        return this.db.select(this.db.raw(`
a.*,a.id as disid, a.dtype as type,drug_name as drug
from disease a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? order by zscore desc
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
    }

    getOrthologDiseasesForOrtholog (ortho, args) {
        return this.db.select(this.db.raw(`
*,id as ordid from ortholog_disease 
where ortholog_id = ?`, [ortho.orid]));
    }

    getDiseasesForOrthologDisease (ortho, args) {
        return this.db.select(this.db.raw(`
a.*,a.id as disid, a.dtype as type,drug_name as drug
from disease a, ortholog_disease b
where a.did = b.did
and b.id = ? order by zscore desc`, [ortho.ordid]));
    }

    getTargetCountsForDisease (disease) {
        return this.db.select(this.db.raw(`
tdl as name, count(*) as value 
from target a, t2tc b, disease c
where a.id=b.target_id and c.protein_id=b.protein_id
and c.name = ? group by tdl
order by value desc`, [disease.name]));
    }

    getTargetsForDisease (disease, args) {
        const DISEASE_SQL = `
a.*,b.*,e.score as novelty, a.id as tcrdid 
from target a, protein b, disease d, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
`;
        let q;
        if (args.filter) {
            let filter = parseFilter (args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(DISEASE_SQL+`
left join tdl_info f on f.protein_id = c.protein_id
and f.itype = ?`, [filter.order]));
            }
            else {
                q = this.db.select(this.db.raw(DISEASE_SQL));
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.name, f.values);
            }
            
            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(?) or 
match(b.name,b.description) against(?))`, [args.filter.term,
                                           args.filter.term]));
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id
and d.protein_id = c.protein_id
and d.name = ?`, [disease.name]))
                .orderBy(filter.sortColumn, filter.dir)
                .limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(DISEASE_SQL+`
where a.id = c.target_id and b.id = c.protein_id
and d.protein_id = c.protein_id
and d.name = ? order by e.score desc
limit ? offset ?`, [disease.name, args.top, args.skip]));
        }
        console.log('>>> getTargetsForDisease: '+q);
        return q;
    }

    getPatentCounts (target, args) {
        return this.db.select(this.db.raw(`
* from patent_count a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? order by year`, [target.tcrdid]));
    }
    getPatentScores (target, args) {
        return this.db.select(this.db.raw(`
* from ptscore a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? order by year`, [target.tcrdid]));
    }
    getPubMedScores (target, args) {
        return this.db.select(this.db.raw(`
* from pmscore a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? order by year`, [target.tcrdid]));
    }

    getPanther (target) {
        return this.db.select(this.db.raw(`
* from p2pc a, panther_class b, t2tc c
where a.panther_class_id = b.id
and a.protein_id = c.protein_id
and c.target_id = ?
order by pcid desc`, [target.tcrdid]));
    }

    getPathwayCounts (target) {
        return this.db.select(this.db.raw(`
pwtype as name, count(*) as value
from pathway a, t2tc b 
where a.protein_id = b.protein_id
and b.target_id = ? 
group by pwtype
order by value desc`, [target.tcrdid]));
    }

    getTargetCountsForPathway (pathway) {
        return this.db.select(this.db.raw(`
a.tdl as name, count(*) as value
from target a, t2tc b, pathway c
where a.id = b.target_id and c.protein_id = b.protein_id
and c.pwtype = ? and c.name = ?
group by a.tdl
order by value desc`, [pathway.type, pathway.name]));
    }

    getTargetCountsForPubMed (pubmed) {
        return this.db.select(this.db.raw(`
a.tdl as name, count(*) as value
from target a, t2tc b, protein2pubmed c
where a.id = b.target_id and c.protein_id = b.protein_id
and c.pubmed_id = ?
group by a.tdl
order by value desc`, [pubmed.pmid]));
    }

    getTargetsForPubMed (pubmed, args) {
        const PUBMED_SQL = `
a.*,b.*,e.score as novelty, a.id as tcrdid 
from target a, protein b, protein2pubmed f, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
`;
        let q;
        if (args.filter) {
            let filter = parseFilter (args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(PUBMED_SQL+`
left join tdl_info d on d.protein_id = c.protein_id
and d.itype = ?`, [filter.order]));
            }
            else {
                q = this.db.select(this.db.raw(PUBMED_SQL));
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.name, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(?) or 
match(b.name,b.description) against(?))`, [args.filter.term,
                                           args.filter.term]));
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pubmed_id = ?`, [pubmed.pmid]))
                .orderBy(filter.sortColumn, filter.dir)
                .limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(PUBMED_SQL+`
where a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pubmed_id = ? 
order by novelty desc
limit ? offset ?`, [pubmed.pmid, args.top, args.skip]));
        }
        console.log('>>> getTargetsForPubMed: '+q);
        return q;
    }
    
    getPathways (target, args) {
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

    getTargetsForPathway (pathway, args) {
        const PATHWAY_SQL = `
a.*,b.*,e.score as novelty, a.id as tcrdid 
from target a, protein b, pathway f, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
`;
        let q;
        if (args.filter) {
            let filter = parseFilter (args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(PATHWAY_SQL+`
left join tdl_info f on f.protein_id = c.protein_id
and f.itype = ?`, [filter.order]));
            }
            else {
                q = this.db.select(this.db.raw(PATHWAY_SQL));
            }

            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.name, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(?) or 
match(b.name,b.description) against(?))`, [args.filter.term,
                                           args.filter.term]));
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pwtype = ? and f.name = ?`, [pathway.type, pathway.name]))
                .orderBy(filter.sortColumn, filter.dir)
                .limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(PATHWAY_SQL+`
where a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pwtype = ? and f.name = ?
order by novelty desc
limit ? offset ?`, [pathway.type, pathway.name, args.top, args.skip]));
        }

        console.log('>>> getTargetsForPathway: '+q);
        return q;
    }

    getLocSigsForTarget (target) {
        return this.db.column({locid: 'id'}, 'location','signal')
            .select().from(this.db.raw(`locsig a, t2tc b`))
            .where(this.db.raw(`
a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
    }

    getPubsForLocSig (locsig) {
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

    getLincsCountsForTarget (target) {
        return this.db.select(this.db.raw(`
cellid as name, count(*) as value
from lincs a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? group by cellid
order by value desc`, [target.tcrdid]));
    }
    
    getLincsForTarget (target, args) {
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

    getKeggDistancesForTarget (target, args) {
        const KEGG_SQL = `
a.id as nid, 'KEGG' as type, distance, 
c.score as novelty, d.tdl as tdl, d.fam as fam, e.sym as sym
from t2tc b1, t2tc b2, target d, protein e, kegg_distance a
left join tinx_novelty c on c.protein_id = a.pid2
`;
        let q;
        if (args.filter) {
            let filter = parseFilter (args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(KEGG_SQL+`
left join tdl_info f on f.protein_id = a.pid2 
and f.itype = ?`, [filter.order]));
            }
            else {
                q = this.db.select(this.db.raw(KEGG_SQL));
            }
            
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.name, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
(match(e.uniprot,e.sym,e.stringid) against(?) or 
match(e.name,e.description) against(?))`, [args.filter.term,
                                           args.filter.term]));
            }
            
            q = q.andWhere(this.db.raw(`
a.pid1 = b1.protein_id and a.pid2 = e.id
and a.pid2 = b2.protein_id and d.id = b2.target_id
and b1.target_id = ?`, [target.tcrdid]))
                .orderBy([{column: 'distance', order: 'asc'},
                          {column: filter.sortColumn, order: filter.dir}])
                .limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(KEGG_SQL+`
where a.pid1 = b1.protein_id
and a.pid2 = e.id
and a.pid2 = b2.protein_id
and d.id = b2.target_id
and b1.target_id = ? order by distance, c.score desc
limit ? offset ?`, [target.tcrdid, args.top, args.skip]));
        }
        return q;
    }

    getTargetForKeggNeighbor (neighbor) {
        return this.db.select(this.db.raw(`
a.*,b.*,a.id as tcrdid, e.score as novelty 
from target a, protein b, kegg_distance d, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
where a.id = c.target_id and b.id = c.protein_id
and b.id = d.pid2 and d.id = ?`, [neighbor.nid]));
    }

    getExpressionCountsForTarget (target) {
        return this.db.select(this.db.raw(`
etype as name, count(*) as value
from expression a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?
group by etype order by value desc`, [target.tcrdid]));
    }

    getExpressionsForTarget (target, args) {
        const EXPRESSION_SQL = `
d.*,f.*, d.id as expid, d.etype as type, 
d.cell_id as cellid, d.oid as btoid
from t2tc c, expression d 
left join uberon f on f.uid = d.uberon_id`;
        let q = this.db.select(this.db.raw(EXPRESSION_SQL));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                if ('type' == f.name)
                    f.name = 'etype';                
                q = q.whereIn(f.name, f.values);
            }

            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
match(d.tissue) against(?)`, [args.filter.term]));
            }
        }
        
        q = q.andWhere(this.db.raw(`            
d.protein_id = c.protein_id
and c.target_id = ?`, [target.tcrdid]))
            .limit(args.top)
            .offset(args.skip);

        console.log('>>> getExpressionForTarget: '+q);
        return q;
    }

    getOrthologCountsForTarget (target) {
        return this.db.select(this.db.raw(`
species as name, count(*) as value
from ortholog a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? group by species
order by value desc`, [target.tcrdid]));
    }
    getOrthologsForTarget (target, args) {
        const ORTHOLOG_SQL = `
a.*,db_id as dbid,a.id as orid, c.score as score
from t2tc b, ortholog a
left join ortholog_disease c on c.ortholog_id = a.id`;
        let q = this.db.select(this.db.raw(ORTHOLOG_SQL));
        if (args.filter) {
            for (var i in args.filter.facets) {
                let f = args.filter.facets[i];
                q = q.whereIn(f.name, f.values);
            }
            
            if (args.filter.term != undefined && args.filter.term !== '') {
                q = q.andWhere(this.db.raw(`
match(a.symbol,a.name) against(?)`, [args.filter.term]));
                nosort = true;
            }
        }
        
        q = q.andWhere(this.db.raw(`
a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));

        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);
        
        console.log('>>> getOrthologCountsForTarget: '+q);
        return q;
    }
}

module.exports = TCRD;
