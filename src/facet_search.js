// extension of TCRD class

const _addProteinListConstraint = function(query, proteinList){
    if(!!proteinList && proteinList.length > 0){
        query.whereIn('b.id', proteinList);
    }
};

module.exports.getTargetTDLCounts = function(args) {
    let q = this.db({a:'target',b:'protein',c:'t2tc'})
        .select({name:'a.tdl'}).count('* as value');
    this._addBatchConstraint(q, args.batch);
    this._addFacetSubQueries(q, args.filter);
    _addProteinListConstraint(q, args.proteinList);
    this._addTargetProteinLink(q);
    q.groupBy('a.tdl').orderBy('value','desc');
    //console.log('>>> getTargetTDLCounts: '+q);
    return q;
};

module.exports.getTargetUniProtKeywordCounts = function(args) {
    let q = this.db.select(this.db.raw(`
d.xtra as name, count(*) as value
from target a, protein b, t2tc c
left join xref d on d.protein_id = c.protein_id and xtype = ?`,
        ['UniProt Keyword']));
    this._addBatchConstraint(q, args.batch);
    this._addFacetSubQueries(q, args.filter);
    _addProteinListConstraint(q, args.proteinList);
    this._addTargetProteinLink(q);
    q.groupBy('xtra').orderBy('value','desc');
    //console.log('>>> getTargetUniProtKeywordCounts: '+q);
    return q;
};

module.exports.getTargetFamilyCounts = function(args) {
    let q = this.db.select(this.db.raw(`
case a.fam 
when 'IC' then 'Ion Channel' 
when 'TF; Epigenetic' then 'TF-Epigenetic' 
when 'TF' then 'Transcription Factor' 
when 'NR' then 'Nuclear Receptor' 
else if(a.fam is null,'Other',a.fam) end as name,count(*) as value
from target a, protein b, t2tc c`));
    this._addBatchConstraint(q, args.batch);
    this._addFacetSubQueries(q, args.filter);
    _addProteinListConstraint(q, args.proteinList);
    this._addTargetProteinLink(q);
    q.groupBy('name').orderBy('value','desc');
    //console.log('>>> getTargetFamilyCounts: '+q);
    return q;
};

module.exports.getTargetDiseaseCounts = function(args, type) {
    let q = this.db.select(this.db.raw(`
a.name as name, count(distinct b.id) as value
from disease a, protein b`));
    this._addBatchConstraint(q,args.batch);
    this._addFacetSubQueries(q,args.filter);
    _addProteinListConstraint(q,args.proteinList);
    q.andWhere(this.db.raw(`a.protein_id = b.id`));
    if (type) {
        q.andWhere(this.db.raw(`a.dtype = ?`, [type]));
    }
    q.groupBy('name').orderBy('value','desc');
    //console.log('>>> getTargetDiseaseCounts: '+q);
    return q;
};

module.exports.getTargetOrthologCounts = function(args) {
    let q = this.db.select(this.db.raw(`
a.species as name, count(*) as value
from ortholog a, protein b`));
    this._addBatchConstraint(q,args.batch);
    this._addFacetSubQueries(q,args.filter);
    _addProteinListConstraint(q,args.proteinList);
    q.andWhere(this.db.raw(`a.protein_id = b.id`));
    q.groupBy('species').orderBy('value','desc');
    //console.log('>>> getTargetOrthologCounts: '+q);
    return q;
};

module.exports.getTargetIMPCPhenotypeCounts = function(args, species) {
    let q;
    if (args.batch || args.filter) {
        q = this.db.select(this.db.raw(`
d.term_name as name, count(distinct b.id) as value
from ortholog a use index (ortholog_idx1), protein b, nhprotein c, phenotype d 
use index(phenotype_nhid_idx)`));
        // MAKE SURE THE TABLE phenotype HAS AN INDEX ON nhprotein_id
        //  COLUMN AND NAMED THE INDEX AS phenotype_nhid_idx
        this._addBatchConstraint(q,args.batch);
        this._addFacetSubQueries(q,args.filter);
        _addProteinListConstraint(q,args.proteinList);
        q.andWhere(this.db.raw(`
a.geneid = c.geneid
and a.taxid = c.taxid
and c.id = d.nhprotein_id 
and a.protein_id = b.id and d.ptype = ?`, ['IMPC']));
        if (species) {
            q.andWhere(this.db.raw(`a.species = ?`, species));
        }
        q.groupBy('term_name').orderBy('value','desc');
    }
    else {
        q = this.db.select(this.db.raw(`name, value from ncats_facet_impc`));
    }
    //console.log('>>> getTargetIMPCPhenotypeCounts: '+q);
    return q;
};

module.exports.getTargetMGIPhenotypeCounts = function(args) {
    let q = this.db.select(this.db.raw(`
term_name as name, count(distinct b.id) as value
from phenotype a, protein b`));
    this._addBatchConstraint(q,args.batch);
    this._addFacetSubQueries(q,args.filter);
    _addProteinListConstraint(q,args.proteinList);
    q.andWhere(this.db.raw(`a.protein_id = b.id
and a.ptype = ?`, ['JAX/MGI Human Ortholog Phenotype']));
    q.groupBy('term_name').orderBy('value','desc');
    //console.log('>>> getTargetMGIPhenotypeCounts: '+q);
    return q;
};

module.exports.getTargetGOCounts = function(args, prefix) {
    let q = this.db.select(this.db.raw(`
substr(go_term,3) as name, count(distinct b.id) as value
from goa a, protein b`));
    this._addBatchConstraint(q,args.batch);
    this._addFacetSubQueries(q,args.filter);
    _addProteinListConstraint(q,args.proteinList);

    q.andWhere(this.db.raw(`a.protein_id = b.id`));
    if (prefix) {
        q.andWhere(this.db.raw(`substr(go_term,1,1) = ?`, prefix));
    }
    q.groupBy('go_term').orderBy('value','desc');
    //console.log('>>> getTargetGOCounts: '+q);
    return q;
};

module.exports.getTargetGWASCounts = function(args) {
    let q = this.db.select(this.db.raw(`
disease_trait as name, count(distinct b.id) as value
from gwas a force index (gwas_idx1), protein b`));
    this._addBatchConstraint(q,args.batch);
    this._addFacetSubQueries(q,args.filter);
    _addProteinListConstraint(q,args.proteinList);
    q.andWhere(this.db.raw(`a.protein_id = b.id`));
    q.groupBy('disease_trait').orderBy('value', 'desc');
    //console.log('>>> getTargetGWASCounts: '+q);
    return q;
};

module.exports.getTargetExpressionCounts = function(args, type) {
    let q;
    if (args.filter || args.batch) {
        // MAKE SURE THE TABLE expression HAS AN INDEX ON COLUMNS
        // (protein_id, etype, and tissue)
        // AND NAMED THE INDEX AS expression_facet_idx
        q = this.db.select(this.db.raw(`
tissue as name, count(distinct protein_id) as value
from expression a use index (expression_facet_idx), protein b`));
        this._addBatchConstraint(q,args.batch);
        this._addFacetSubQueries(q,args.filter);
        _addProteinListConstraint(q,args.proteinList);

        q.andWhere(this.db.raw(`a.protein_id = b.id`));
        if (type)
            q.andWhere(this.db.raw(`etype = ?`, [type]));
        q.groupBy('tissue').orderBy('value', 'desc');
    }
    else {
        q = this.db.select(this.db.raw(`name, value from ncats_facet_expression`));
        if (type)
            q.andWhere(this.db.raw(`etype=?`, [type]));
        q.orderBy('value', 'desc');
    }

    console.log('>>> getTargetExpressionCounts: '+q);
    return q;
};

