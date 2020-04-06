// extension of TCRD class
const CONSTANTS = require("./constants");
const utils = require("./target_search_utils");

module.exports.getTargets = function(args) {
    //console.log('>>> getTargets: '+JSON.stringify(args));
    let q = undefined;
    if (args.filter && !args.batch) {
        q = this.getTargetsForTerm(args);
    } else {
        q = this.getTargetsForBatch(args);
    }
    //console.log(q.toString());
    return q;
};

module.exports._getBaseTargetSearchQuery = function(searchTerm, customOrderInfo) {
    let columnList = ['a.*', 'b.uniprot', 'b.sym', 'b.seq', 'e.score as novelty', 'a.id as tcrdid', 'b.description as name', 'f.string_value as description'];
    if (!!searchTerm) {
        columnList.push('sq.min_score', 'sq.match', 'sq.match_score');
    }

    let targetQuery = this.db.select(columnList)
        .from({a: 'target', b: 'protein', c: 't2tc'})
        .leftJoin(this.db.raw('tinx_novelty as e use index(tinx_novelty_idx3) on e.protein_id = c.protein_id'));
    if (!!customOrderInfo && !!customOrderInfo.order) {
        targetQuery.leftJoin(this.db.raw(`tdl_info d on d.protein_id = c.protein_id and d.itype = '${customOrderInfo.order}'`));
    }
    targetQuery.leftJoin(this.db.raw(`tdl_info f on f.protein_id = c.protein_id and f.itype = '${CONSTANTS.DESCRIPTION_TYPE}'`));
    return targetQuery;
};

module.exports._addFacetSubQueries = function(targetQuery, filter){
    if(!!filter && !!filter.facets) {
        let sub = this.getTargetFacetSubQueries(filter.facets);
        sub.forEach(subq => {
            targetQuery.whereIn('b.id', subq);
        });
    }
};

module.exports._addBatchConstraint = function(targetQuery, batch){
    if (!!batch && batch.length > 0) {
        targetQuery.andWhere
        (builder => builder.whereIn('b.uniprot', batch)
            .orWhereIn('b.sym', batch)
            .orWhereIn('b.stringid', batch));
    }
};

module.exports._addTargetProteinLink = function(targetQuery){
    targetQuery.andWhere('a.id', this.db.raw('c.target_id'))
        .andWhere('b.id', this.db.raw('c.protein_id'));
};

module.exports._addSearchTermConstraint = function(targetQuery,term){
    if (!!term) {
        targetQuery.rightJoin({sq: this.getScoredProteinList(term)}, 'sq.protein_id', 'c.protein_id');
    }
};

module.exports._addCustomSorting = function(targetQuery,orderInfo){
    let prefix = '';
    if ('novelty' != orderInfo.sortColumn) {
        prefix = 'd.';
    }
    targetQuery.orderBy(prefix + orderInfo.sortColumn, orderInfo.dir);
};

module.exports.getTargetsForTerm = function(args) {
    let customOrderInfo = utils.parseFilterOrder(args.filter);
    let searchTerm = args.filter.term;

    let targetQuery = this._getBaseTargetSearchQuery(searchTerm, customOrderInfo);
    this._addFacetSubQueries(targetQuery,args.filter);
    this._addSearchTermConstraint(targetQuery,searchTerm);
    this._addTargetProteinLink(targetQuery);
    if (!searchTerm || !!customOrderInfo.order) {
        this._addCustomSorting(targetQuery,customOrderInfo);
    } else { // sort by search term constraint
        targetQuery = targetQuery.orderBy(['sq.min_score', {column: 'sq.match_score', order: 'desc'}, 'sq.match']);
    }
    targetQuery.limit(args.top).offset(args.skip);
    return targetQuery;
};

module.exports.getTargetsForBatch = function(args) {
    let targetQuery = this._getBaseTargetSearchQuery("","");
    this._addBatchConstraint(targetQuery,args.batch);
    this._addFacetSubQueries(targetQuery, args.filter);
    this._addTargetProteinLink(targetQuery);
    targetQuery.orderBy([{column:'novelty', order:'desc'}])
        .limit(args.top).offset(args.skip);
    return targetQuery;
};

module.exports._getTargetListQuery = function(term) {
    let firstWordMatch = '^' + term;
    let anyWordMatch = '[[:<:]]' + term;

    let proteinQuery = this.proteinSearch(this.db, firstWordMatch, 1);
    let proteinAliasQuery = this.proteinAliasSearch(this.db, firstWordMatch, 1.5);
    let targetFirstWordQuery = this.targetSearch(this.db, firstWordMatch, 2);
    let targetAnyWordQuery = this.targetSearch(this.db, anyWordMatch, 2.5);
    let diseaseAnyWordQuery = this.diseaseSearch(this.db, anyWordMatch, 3);
    let phenotypeAnyWordQuery = this.phenotypeSearch(this.db, anyWordMatch, 4);
    let keywordAnyWordQuery = this.keywordSearch(this.db, anyWordMatch, 5);
    let infoAnyWordQuery = this.tdlInfoSearch(this.db, anyWordMatch, 10);

    return proteinQuery.union(
        proteinAliasQuery,
        targetFirstWordQuery,
        targetAnyWordQuery,
        keywordAnyWordQuery,
        diseaseAnyWordQuery,
        phenotypeAnyWordQuery,
        infoAnyWordQuery).as('targetQuery');
};

module.exports.getProteinList = function(term) {
    return this.db.select('protein_id').from(this._getTargetListQuery(term));
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
        .where('string_value', 'regexp', term);
};
module.exports.xrefXtraSearch = function (db, term, score) {
    return db('xref')
        .select({protein_id: 'protein_id', match: 'xtra', score: score, match_score: 1})
        .where('value', 'regexp', term)
        .orWhere('xtra', 'regexp', term)
};
