const { SQLDataSource } = require("datasource-sql");

const MINUTE = 60;

const DESCRIPTION_TYPE =
      //'UniProt Function';
      'NCBI Gene Summary';

const TARGET_SQL = `
a.*,b.*,e.score as novelty, a.id as tcrdid, 
b.description as name, f.string_value as description
from target a, protein b, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info f on f.protein_id = c.protein_id 
and f.itype = '${DESCRIPTION_TYPE}'
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

function targetFacetMapping (facet) {
    switch (facet) {
    case 'Target Development Level': return 'tdl';
    case 'Family': return 'fam';
    case 'Keyword': return 'UniProt Keyword';
    case 'Indication': return 'DrugCentral Indication';
    case 'Monarch Disease': return 'Monarch';
    case 'IMPC Phenotype': return 'IMPC';
    case 'JAX/MGI':
    case 'JAX/MGI Phenotype':
        return 'JAX/MGI Human Ortholog Phenotype';
    default:
        if (facet.startsWith('Expression:'))
            return 'Expression';
    }
    return facet;
}

function diseaseFacetMapping (facet) {
    switch (facet) {
    case 'type':
    case 'Data Source':
        return 'dtype';
        
    case 'Target Development Level':
        return 'tdl';
    }
    return facet;
}

class TCRD extends SQLDataSource {
    getTargetGOFacetSubquery (values, prefix) {
        let q = this.db.select(this.db.raw(`protein_id from goa`))
            .whereIn('go_term', values.map(x => {
                if (!x.startsWith(prefix))
                    return prefix+x;
                return x;
            }));
        return q;
    }
    
    getTargetFacetSubQueries (facets) {
        let subqueries = []
        for (var i in facets) {
            let f = facets[i];
            let fn = targetFacetMapping (f.facet);
            switch (fn) {
            case 'tdl':
                { let q = this.db.select(this.db.raw(`
protein_id from target a, t2tc b`))
                      .whereIn('tdl', f.values)
                      .andWhere(this.db.raw(`a.id = b.target_id`));
                  subqueries.push(q);
                }
                break;

            case 'fam':
                { let q = this.db.select(this.db.raw(`
protein_id from target a, t2tc b`));
                  let fam = [];
                  let hasNull = false;
                  
                  f.values.forEach(v => {
                      switch (v) {
                      case 'Ion Channel': v = 'IC'; break;
                      case 'TF-Epigenetic': v= 'TF; Epigenetic'; break;
                      case 'Transcription Factor': v = 'TF'; break;
                      case 'Nuclear Receptor': v = 'NR'; break;
                      case 'Other': case 'Non-IDG': v = null; break;
                      }
                      if (v != null)
                          fam.push(v);
                      else
                          hasNull = true;
                  });

                  if (hasNull) {
                      q = q.where(sub =>
                                  sub.whereIn('fam', fam).orWhereNull('fam'));
                  }
                  else {
                      q = q.whereIn('fam', fam);
                  }

                  q = q.andWhere(this.db.raw(`a.id = b.target_id`));
                  subqueries.push(q);
                }
                break;

            case 'UniProt Keyword':
                { let q = this.db.select(this.db.raw(`protein_id from xref`))
                      .whereIn('xtra', f.values)
                      .andWhere(this.db.raw(`xtype = ?`, [fn]));
                  subqueries.push(q);
                }
                break;

            case 'UniProt Disease':
            case 'Monarch':
            case 'DrugCentral Indication':
                { let q = this.db.select(this.db.raw(`
distinct protein_id from disease`))
                      .whereIn('name', f.values)
                      .andWhere(this.db.raw(`dtype = ?`, [fn]));
                  subqueries.push(q);
                }
                break;

            case 'Ortholog':
                { let q =
                      this.db.select(this.db.raw(`
distinct protein_id from ortholog`))
                      .whereIn('species', f.values);
                  subqueries.push(q);
                }
                break;

            case 'JAX/MGI Human Ortholog Phenotype':
            case 'IMPC':
                { let q = this.db.select(this.db.raw(`
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

            case 'Expression':
                { let type = f.facet.substring(11).trim();
                  let q = this.db.select(this.db.raw(`
distinct protein_id from expression`))
                      .whereIn('tissue', f.values)
                      .andWhere(this.db.raw(`etype = ?`, type));
                  subqueries.push(q);
                }
                break;
            }
        }
        return subqueries;
    }

    getDiseaseFacetSubQueries (facets) {
        let subqueries = [];
        facets.forEach(f => {
            let fn = diseaseFacetMapping (f.facet);
            switch (fn) {
            case 'dtype':
                { let q = this.db.select(this.db.raw(`
id from disease`))
                      .whereIn('dtype', f.values);
                  subqueries.push(q);
                }
                break;

            case 'tdl':
                { let q = this.db.select(this.db.raw(`
distinct a.id from disease a, target b, t2tc c`))
                      .whereIn('b.tdl', f.values)
                      .andWhere(this.db.raw(`a.protein_id = c.protein_id
and b.id = c.target_id`));
                  subqueries.push(q);
                }
                break;
            }
        });
        return subqueries;
    }
    
    getTarget (args) {
        //console.log('>>> getTarget: '+JSON.stringify(args));
        if (args.uniprot || args.sym || args.stringid) {
            var value;
            if (args.uniprot) value = args.uniprot;
            else if (args.sym) value = args.sym;
            else value = args.stringid;
            return this.db.select(this.db.raw(TARGET_SQL+`
and match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)`, [value]));
        }
        
        if (args.geneid) {
            return this.db.select(this.db.raw(TARGET_SQL+`
and b.geneid=?`, [args.geneid]));
        }
        
        return this.db.select(this.db.raw(TARGET_SQL+`
and a.id = ?`, [args.tcrdid]));
    }

    searchTargets (args) {
        let q = this.db.select(this.db.raw(`
a.*,b.*,e.score as novelty, a.id as tcrdid, 
b.description as name, d.string_value as description
from target a, protein b, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info d on d.protein_id = c.protein_id
and d.itype = '${DESCRIPTION_TYPE}'
where a.id = c.target_id and b.id = c.protein_id
and (match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or c.protein_id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or c.protein_id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or c.protein_id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode))
) order by case 
  when b.uniprot=? then 1
  when b.sym=? then 2
  when b.stringid=? then 3
  else 1000
end`, [args.term, args.term, args.term, args.term,
       args.term, args.term, args.term]));
        
        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);
        
        //console.log('>>> searchTargets: '+q);
        return q;
    }

    getTargetTDLCounts (args) {
        let q = this.db.select(this.db.raw(`
a.tdl as name, count(*) as value
from target a, protein b, t2tc c`));

        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or c.protein_id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or c.protein_id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or c.protein_id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(
            `a.id = c.target_id and b.id = c.protein_id`))
            .groupBy('name')
            .orderBy('value', 'desc');
        
        //console.log('>>> getTargetTDLCounts: '+q);
        return q;
    }

    getTargetUniProtKeywordCounts (args) {
        let q = this.db.select(this.db.raw(`
d.xtra as name, count(*) as value
from target a, protein b, t2tc c
left join xref d on d.protein_id = c.protein_id and xtype = ?`,
                                           ['UniProt Keyword']));

        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or c.protein_id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or c.protein_id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or c.protein_id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(
            `a.id = c.target_id and b.id = c.protein_id`))
            .groupBy('name')
            .orderBy('value', 'desc');
        
        //console.log('>>> getTargetUniProtKeywordCounts: '+q);
        return q;        
    }

    getTargetFamilyCounts (args) {
        let q = this.db.select(this.db.raw(`
case a.fam 
when 'IC' then 'Ion Channel' 
when 'TF; Epigenetic' then 'TF-Epigenetic' 
when 'TF' then 'Transcription Factor' 
when 'NR' then 'Nuclear Receptor' 
else if(a.fam is null,'Other',a.fam) end as name,count(*) as value
from target a, protein b, t2tc c`));

        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or c.protein_id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or c.protein_id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or c.protein_id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(
            `a.id = c.target_id and b.id = c.protein_id`))
            .groupBy('name')
            .orderBy('value', 'desc');
        
        //console.log('>>> getTargetFamilyCounts: '+q);
        return q;        
    }

    getTargetOrthologCounts (args) {
        let q = this.db.select(this.db.raw(`
a.species as name, count(*) as value
from ortholog a, protein b`));

        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or b.id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or b.id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or b.id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(`a.protein_id = b.id`))
            .groupBy('a.species')
            .orderBy('value', 'desc');
        
        //console.log('>>> getTargetOrthologCounts: '+q);
        return q;        
    }

    getTargetDiseaseCounts (args, type) {
        let q = this.db.select(this.db.raw(`
a.name as name, count(*) as value
from disease a, protein b`));

        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or b.id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or b.id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or b.id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(`a.protein_id = b.id`));
        if (type) {
            q = q.andWhere(this.db.raw(`a.dtype = ?`, [type]));
        }
        q = q.groupBy('a.name')
            .orderBy('value', 'desc');
        
        //console.log('>>> getTargetDiseaseCounts: '+q);
        return q;
    }

    getTargetIMPCPhenotypeCounts (args, species) {
        // MAKE SURE THE TABLE phenotype HAS AN INDEX ON nhprotein_id COLUMN
        // AND NAMED THE INDEX AS phenotype_nhid_idx
        let q = this.db.select(this.db.raw(`
d.term_name as name, count(distinct b.id) as value
from ortholog a, protein b, nhprotein c, phenotype d 
use index(phenotype_nhid_idx)`));
        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or b.id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or b.id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or b.id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        q = q.andWhere(this.db.raw(`
a.geneid = c.geneid
and a.taxid = c.taxid
and c.id = d.nhprotein_id 
and a.protein_id = b.id and d.ptype = ?`, ['IMPC']));
        if (species) {
            q = q.andWhere(this.db.raw(`a.species = ?`, species));
        }
        q = q.groupBy('d.term_name')
            .orderBy('value', 'desc');
        
        //console.log('>>> getTargetIMPCPhenotypeCounts: '+q);
        return q;
    }

    getTargetMGIPhenotypeCounts (args) {
        let q = this.db.select(this.db.raw(`
term_name as name, count(distinct b.id) as value
from phenotype a, protein b`));
        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or b.id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or b.id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or b.id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        q = q.andWhere(this.db.raw(`a.protein_id = b.id
and a.ptype = ?`, ['JAX/MGI Human Ortholog Phenotype']))
            .groupBy('term_name')
            .orderBy('value', 'desc');
        
        //console.log('>>> getTargetMGIPhenotypeCounts: '+q);
        return q;
    }

    getTargetGOCounts (args, prefix) {
        let q = this.db.select(this.db.raw(`
substr(go_term,3) as name, count(distinct b.id) as value
from goa a, protein b`));
        
        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or b.id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or b.id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or b.id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(`a.protein_id = b.id`));
        if (prefix) {
            q = q.andWhere(this.db.raw(`substr(go_term,1,1) = ?`, prefix));
        }
        q = q.groupBy('go_term')
            .orderBy('value', 'desc');

        //console.log('>>> getTargetGOCounts: '+q);
        return q;
    }

    getTargetGWASCounts (args) {
        let q = this.db.select(this.db.raw(`
disease_trait as name, count(*) as value
from gwas a, protein b`));
        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or b.id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or b.id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or b.id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(`a.protein_id = b.id`))
            .groupBy('disease_trait')
            .orderBy('value', 'desc');

        //console.log('>>> getTargetGWASCounts: '+q);
        return q;
    }

    getTargetExpressionCounts (args, type) {
        // MAKE SURE THE TABLE expression HAS AN INDEX ON protein_id COLUMN
        // AND NAMED THE INDEX AS expression_pid_idx
        let q = this.db.select(this.db.raw(`
tissue as name, count(distinct protein_id) as value
from expression a use index (expression_pid_idx), protein b`));
        
        if (args.filter) {
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or a.protein_id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or a.protein_id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or a.protein_id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
            }
        }
        
        q = q.andWhere(this.db.raw(`a.protein_id = b.id`));
        if (type)
            q = q.andWhere(this.db.raw(`etype = ?`, [type]));
        q = q.groupBy('tissue')
            .orderBy('value', 'desc');
        
        console.log('>>> getTargetExpressionCounts: '+q);
        return q;        
    }
    
    getTargets (args) {
        //console.log('>>> getTargets: '+JSON.stringify(args));
        let q = undefined;
        if (args.filter) {
            let filter = parseFilter (args.filter);
            if (filter.order) {
                q = this.db.select(this.db.raw(`
a.*,b.*,e.score as novelty, a.id as tcrdid, 
b.description as name, f.string_value as description
from target a, protein b, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info d 
on c.protein_id = d.protein_id and d.itype = ?
left join tdl_info f on f.protein_id = c.protein_id 
and f.itype = '${DESCRIPTION_TYPE}'`, [filter.order]));
            }
            else {
                q = this.db.select(this.db.raw(`
a.*,b.*,e.score as novelty, a.id as tcrdid, 
b.description as name, f.string_value as description
from target a, protein b, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info f on f.protein_id = c.protein_id
and f.itype = '${DESCRIPTION_TYPE}'`));
            }
            
            let sub = this.getTargetFacetSubQueries(args.filter.facets);
            sub.forEach(subq => {
                q = q.whereIn('b.id', subq);
            });

            let sort = true;
            let t = args.filter.term;
            if (t != undefined && t !== '') {
                q = q.andWhere(this.db.raw(`
(match(b.uniprot,b.sym,b.stringid) against(? in boolean mode)
     or c.protein_id in 
          (select protein_id from alias 
            where match(value) against(? in boolean mode)) 
     or c.protein_id in 
          (select protein_id from xref 
            where match(value,xtra) against(? in boolean mode))
     or c.protein_id in
          (select protein_id from tdl_info
            where match(string_value) against(? in boolean mode)))
`, [t, t, t, t]));
                sort = false;
            }

            q = q.andWhere(this.db.raw(`
a.id = c.target_id and b.id = c.protein_id`));
            if (sort || filter.order) {
                let prefix = '';
                if ('novelty' != filter.sortColumn)
                    prefix = 'd.';
                q = q.orderBy(prefix+filter.sortColumn, filter.dir);
            }

            q = q.limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(TARGET_SQL+`
order by novelty desc limit ? offset ?`, [args.top, args.skip]));
        }
        //console.log('>>> getTargets: '+q);
        
        return q;
    }

    
    getDiseaseDataSourceCounts (args) {
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
    
    getDiseaseTDLCounts (args) {
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
        
        console.log('>>> getDiseaseTDLCounts: '+q);
        return q;
    }

    getDiseaseDrugCounts (args) {
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

    getDiseases (args) {
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

        console.log('>>> getDiseases: '+q);
        return q;
    }
    
    getDiseaseAssociations (args, constraints) {
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
        
        console.log('>>> getDiseaseAssociations: '+q);
        return q;
    }

    getDiseaseAssociationsForDisease (disease, args) {
        console.log('~~~~ disease: '+JSON.stringify(disease));
        return this.getDiseaseAssociations(args, q => {
            return q.andWhere(this.db.raw(`name = ?`, [disease.name]));
        });
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
where match(title,abstract) against(? in boolean mode)`, [args.term]));
        }
        return this.db.select(this.db.raw(`
count(*) as cnt from pubmed`));
    }

    getPubTDLCounts (args) {
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
    
    getPubs (args) {
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
    
    getXrefsForTarget (target) {
        //console.log('>>> getXrefsForTarget: '+target.tcrdid);
        return this.db.select(this.db.raw(`
xtype as source, value 
from xref where protein_id = ?`, [target.tcrdid]));
    }

    getPropsForTarget (target) {
        //console.log('>>> getProps: '+target.tcrdid);
        return this.db.select(this.db.raw(`
a.* from tdl_info a, t2tc b
where b.target_id = ? and a.protein_id = b.protein_id`, [target.tcrdid]));
    }

    getSynonymsForTarget (target) {
        return this.db.select(this.db.raw(`
a.type as name, a.value as value  
from alias a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ?`, [target.tcrdid]));
    }

    getTargetsForXref (xref) {
        //console.log('>>> getTargetForXref: '+JSON.stringify(xref));
        return this.db.select(this.db.raw(`
a.*,b.*,a.id as tcrdid, 
b.description as name, f.string_value as description
from target a, protein b, t2tc c, xref d
left join tdl_info f on f.protein_id = d.protein_id 
and f.itype = '${DESCRIPTION_TYPE}'
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
        //console.log('>>> getPPIsForTarget: '+q);
        return q;
    }

    getTargetForPPINeighbor (neighbor) {
        //console.log('>>> getTargetForNeighbor: '+neighbor.nid);
        return this.db.select(this.db.raw(`
a.*,b.*,a.id as tcrdid, e.score as novelty, 
b.description as name, f.string_value as description
from target a, protein b, ppi d, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info f on f.protein_id = c.protein_id 
and f.itype = '${DESCRIPTION_TYPE}'
where a.id = c.target_id and b.id = c.protein_id
and b.id = d.protein2_id and d.id = ?`, [neighbor.nid]));
    }

    getPPIPropsForNeighbor (neighbor) {
        //console.log('>>> getPropsForNeighbor: '+neighbor.nid);
        return this.db.select(this.db.raw(`
* from ppi where id = ?`, [neighbor.nid]));
    }

    getDiseasesForTarget (target, args) {
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
and b.target_id = ?`, [target.tcrdid]));
        if (sort)
            q = q.orderBy('a.score', 'desc');
        
        if (args.top)
            q = q.limit(args.top);
        if (args.skip)
            q = q.offset(args.skip);

        return q;
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

    getTargetCountsForDiseaseAssociation (disease) {
        return this.db.select(this.db.raw(`
tdl as name, count(*) as value 
from target a, t2tc b, disease c
where a.id=b.target_id and c.protein_id=b.protein_id
and c.name = ? group by tdl
order by value desc`, [disease.name]));
    }

    getTargetsForDiseaseAssociation (disease, args) {
        const DISEASE_SQL = `
a.*,b.*,e.score as novelty, a.id as tcrdid,
b.description as name, g.string_value as description
from target a, protein b, disease d, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info g on g.protein_id = c.protein_id and
g.itype = '${DESCRIPTION_TYPE}'`;
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
and d.protein_id = c.protein_id
and d.name = ?`, [disease.name]));
            if (sort) {
                q = q.orderBy(filter.sortColumn, filter.dir);
            }
            
            q = q.limit(args.top)
                .offset(args.skip);
        }
        else {
            q = this.db.select(this.db.raw(DISEASE_SQL+`
where a.id = c.target_id and b.id = c.protein_id
and d.protein_id = c.protein_id
and d.name = ? order by e.score desc
limit ? offset ?`, [disease.name, args.top, args.skip]));
        }
        //console.log('>>> getTargetsForDisease: '+q);
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
a.*,b.*,e.score as novelty, a.id as tcrdid,
b.description as name, g.string_value as description
from target a, protein b, protein2pubmed f, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info g on g.protein_id = c.protein_id and 
g.itype = '${DESCRIPTION_TYPE}'
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
and f.pubmed_id = ?`, [pubmed.pmid]));
            if (sort) {
                q = q.orderBy(filter.sortColumn, filter.dir);
            }
            q = q.limit(args.top)
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
        //console.log('>>> getTargetsForPubMed: '+q);
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
a.*,b.*,e.score as novelty, a.id as tcrdid,
b.description as name, g.string_value as description
from target a, protein b, pathway f, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info g on g.protein_id = c.protein_id 
and g.itype = '${DESCRIPTION_TYPE}'`;
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
        }
        else {
            q = this.db.select(this.db.raw(PATHWAY_SQL+`
where a.id = c.target_id and b.id = c.protein_id
and f.protein_id = c.protein_id
and f.pwtype = ? and f.name = ?
order by novelty desc
limit ? offset ?`, [pathway.type, pathway.name, args.top, args.skip]));
        }

        //console.log('>>> getTargetsForPathway: '+q);
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

    getLINCSCountsForTarget (target) {
        return this.db.select(this.db.raw(`
cellid as name, count(*) as value
from lincs a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? group by cellid
order by value desc`, [target.tcrdid]));
    }
    
    getLINCSForTarget (target, args) {
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
a.*,b.*,a.id as tcrdid, e.score as novelty,
b.description as name, f.string_value as description
from target a, protein b, kegg_distance d, t2tc c
left join tinx_novelty e on e.protein_id = c.protein_id
left join tdl_info f on f.protein_id = c.protein_id 
and f.itype = '${DESCRIPTION_TYPE}'
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

    getOrthologSpeciesCounts (args) {
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

    getOrthologTDLCounts (args) {
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
    
    getOrthologCounts () {
        return this.db.select(this.db.raw(`
species as name, count(*) as value
from ortholog 
group by species
order by value desc`));
    }

    getOrthologs (args) {
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

    getGWASCountsForTarget (target) {
        return this.db.select(this.db.raw(`
disease_trait as name, count(*) as value
from gwas a, t2tc b
where a.protein_id = b.protein_id
and b.target_id = ? group by disease_trait
order by value desc`, [target.tcrdid]));
    }
    getGWASForTarget (target, args) {
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
                    }
                    else if (f.start) {
                        q = q.andWhere(this.db.raw(`? >= ?`, [f.facet, f.start]));
                    }
                    else {
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
}

module.exports = TCRD;
