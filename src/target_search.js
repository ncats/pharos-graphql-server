// extension of TCRD class

module.exports.getProteinListFromPPI = function(ppiTarget, confidence) {
    let proteinIDquery = this.db("protein")
        .select("id").whereRaw(this.db.raw(`match(uniprot,sym,stringid) against('${ppiTarget}' in boolean mode)`));
    let ppiListQuery = this.db("ncats_ppi")
        .select(this.db.raw('distinct other_id as protein_id'))
        .whereIn('protein_id', proteinIDquery)
        .whereNot(function(){
            this.where('score','<', confidence).andWhere('ppitypes','STRINGDB');
        });
    return ppiListQuery;
};

module.exports._getTargetListQuery = function(term) {
    let firstWordMatch = '^' + term;
    let anyWordMatch = '[[:<:]]' + term;

    let proteinQuery = this.proteinSearch(this.db, firstWordMatch, 1);
    let proteinAliasQuery = this.proteinAliasSearch(this.db, firstWordMatch, 1.5);
    let proteinEnsemblQuery = this.proteinEnsemblSearch(this.db, term, 1.5);
    let targetFirstWordQuery = this.targetSearch(this.db, firstWordMatch, 2);
    let targetAnyWordQuery = this.targetSearch(this.db, anyWordMatch, 2.5);
    let diseaseAnyWordQuery = this.diseaseSearch(this.db, anyWordMatch, 3);
    let phenotypeAnyWordQuery = this.phenotypeSearch(this.db, anyWordMatch, 4);
    let keywordAnyWordQuery = this.keywordSearch(this.db, anyWordMatch, 5);
    let infoAnyWordQuery = this.tdlInfoSearch(this.db, anyWordMatch, 10);

    return proteinQuery.union(
        proteinAliasQuery,
        proteinEnsemblQuery,
        targetFirstWordQuery,
        targetAnyWordQuery,
        keywordAnyWordQuery,
        diseaseAnyWordQuery,
        phenotypeAnyWordQuery,
        infoAnyWordQuery).as('targetQuery');
};

module.exports.getProteinList = function(term) {
    return this.db.distinct('protein_id').from(this._getTargetListQuery(term));
};

module.exports.getScoredProteinList = function(term) {
    return this.db.select(['protein_id', 'match']).min('score as min_score').max('match_score as match_score').from(this._getTargetListQuery(term)).groupBy('protein_id');
};

module.exports.proteinSearch = function (db, term, score) {
    return db({pro: 'protein'})
        .select({protein_id: 'id', match: 'sym', score: score, match_score: 1})
        .where('sym', 'regexp', term)
        .orWhere('uniprot', 'regexp', term)
        .orWhere('stringid', 'regexp', term);
};

module.exports.proteinAliasSearch = function (db, term, score) {
    return db({alias: 'alias'})
        .select({protein_id: 'protein_id', match: 'value', score: score, match_score: 1})
        .where('value', 'regexp', term);
};
module.exports.proteinEnsemblSearch = function (db, term, score) {
    return db({xref: 'xref'})
        .select({protein_id: 'protein_id', match: 'value', score: score, match_score: 1})
        .where('xtype', 'Ensembl')
        .andWhere('value', term);
};
module.exports.targetSearch = function (db, term, score) {
    return db({tar: 'target', link: "t2tc"})
        .select({protein_id: 'link.protein_id', match: 'tar.name', score: score, match_score: 1})
        .where('tar.name', 'regexp', term)
        .andWhere('tar.id', db.raw('link.target_id'));
};
module.exports.keywordSearch = function (db, term, score) {
    return db('xref')
        .select({protein_id: 'protein_id', match: 'xtra', score: score})
        .count('* as match_score')
        .where('xtype', 'UniProt Keyword')
        .andWhere('xtra', 'regexp', term)
        .groupBy('protein_id');
};
module.exports.diseaseSearch = function (db, term, score) {
    return db('disease')
        .select({protein_id: 'protein_id', match: 'name', score: score})
        .count('* as match_score')
        .where('name', 'regexp', term)
        .groupBy('protein_id');
};
module.exports.phenotypeSearch = function (db, term, score) {
    return db('phenotype')
        .select({protein_id: 'protein_id', match: 'term_name', score: score, match_score: 1})
        .where('ptype', 'JAX/MGI Human Ortholog Phenotype')
        .andWhere('term_name', 'regexp', term);
};
module.exports.tdlInfoSearch = function (db, term, score) {
    return db('tdl_info')
        .select({protein_id: 'protein_id', match: 'string_value', score: score, match_score: 1})
        .where('string_value', 'regexp', term)
        .whereIn('itype',['UniProt Function','NCBI Gene Summary']);
};
