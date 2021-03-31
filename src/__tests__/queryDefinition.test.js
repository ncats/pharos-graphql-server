const {QueryDefinition} = require('../models/queryDefinition');

const mockBuildableObj = {
    getSpecialModelWhereClause: function () {return '';},
    rootTable: 'protein'
};

describe('Query Builder Tests', function () {
    test('one column should work', () => {
        const qb = QueryDefinition.GenerateQueryDefinition(mockBuildableObj, [
            {table: 'target', column: 'tdl'}
        ]);
        expect(qb.buildable.rootTable).toBe('protein');
        expect(qb.tables.length).toBe(1);
        expect(qb.tables[0].tableName).toBe('target');
        expect(qb.tables[0].columns.length).toBe(1);
        expect(qb.tables[0].columns[0].column).toBe('tdl');
    });

    test('two columns in one table', () => {
        const qb = QueryDefinition.GenerateQueryDefinition(mockBuildableObj, [
            {table: 'target', column: 'tdl'},
            {table: 'target', column: 'fam'}
        ]);
        expect(qb.buildable.rootTable).toBe('protein');
        expect(qb.tables.length).toBe(1);
        expect(qb.tables[0].tableName).toBe('target');
        expect(qb.tables[0].columns.length).toBe(2);
        expect(qb.tables[0].columns[0].column).toBe('tdl');
        expect(qb.tables[0].columns[1].column).toBe('fam');
    });

    test('two columns in two tables - different where_clause', () => {
        const qb = QueryDefinition.GenerateQueryDefinition(mockBuildableObj, [
            {table: 'target', column: 'tdl'},
            {table: 'target', column: 'fam', where_clause: 'fam is not null'}
        ]);
        expect(qb.buildable.rootTable).toBe('protein');
        expect(qb.tables.length).toBe(2);
        expect(qb.tables[0].tableName).toBe('target');
        expect(qb.tables[0].columns.length).toBe(1);
        expect(qb.tables[0].columns[0].column).toBe('tdl');

        expect(qb.tables[1].tableName).toBe('target');
        expect(qb.tables[1].columns.length).toBe(1);
        expect(qb.tables[1].columns[0].column).toBe('fam');
        expect(qb.tables[1].joinConstraint).toBe('fam is not null');
    });

    test('four columns in two tables - different where_clause', () => {
        const qb = QueryDefinition.GenerateQueryDefinition(mockBuildableObj,[
            {table: 'target', column: 'tdl'},
            {table: 'target', column: 'fam', where_clause: 'fam is not null'},
            {table: 'target', column: 'name'},
            {table: 'target', column: 'name', where_clause: 'fam is not null'}
        ]);
        expect(qb.buildable.rootTable).toBe('protein');
        expect(qb.tables.length).toBe(2);
        expect(qb.tables[0].tableName).toBe('target');
        expect(qb.tables[0].columns.length).toBe(2);
        expect(qb.tables[0].columns[0].column).toBe('tdl');
        expect(qb.tables[0].columns[1].column).toBe('name');
        expect(qb.tables[0].joinConstraint).toBe('');

        expect(qb.tables[1].tableName).toBe('target');
        expect(qb.tables[1].columns.length).toBe(2);
        expect(qb.tables[1].columns[0].column).toBe('fam');
        expect(qb.tables[1].columns[1].column).toBe('name');
        expect(qb.tables[1].joinConstraint).toBe('fam is not null');
    });



});
