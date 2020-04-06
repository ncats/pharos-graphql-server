const fs = require('fs');
const request = require('sync-request');
const tester = require('graphql-tester').tester;
testDirectory = './tests';

url = 'http://localhost:4000/graphql/';

function postit(query) {
    return request('POST', url, {
        json: {query: query},
    });
}

describe('GraphQL API Tests', function () {

    const self = this;
    beforeAll(() => {
        self.test = tester({
            url: url,
            contentType: 'application/json'
        });
    });

    var testCase = 'test01';
    var testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse01 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse01.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse01.body.toString());
        expect(obj.data.search.targetResult.facets.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse01.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test02';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse02 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse02.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse02.body.toString());
        expect(obj.data.search.targetResult.targets["0"].diseases.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse02.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test03';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse03 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse03.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse03.body.toString());
        expect(obj.data.search.targetResult.targets["0"].gwas[0].trait.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse03.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test04';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse04 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse04.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse04.body.toString());
        expect(obj['data'].pubmed.targets["0"].expressionCounts["0"].name.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse04.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test05';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse05 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse05.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse05.body.toString());
        expect(obj['data'].targets.targets["0"].pubTatorScores["0"].year > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse05.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test06';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse06 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse06.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse06.body.toString());
        expect(obj['data'].target.ppis["0"].target.sym.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse06.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test07';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse07 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse07.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse07.body.toString());
        expect(obj['data'].targets.facet_group1["0"].values["0"].value > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse07.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test08';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse08 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse08.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse08.body.toString());
        expect(obj['data'].pubmed.targets["0"].locsigs["0"].pubs["0"].title.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse08.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test09';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse09 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse09.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse09.body.toString());
        expect(obj['data'].pubs.pubs["0"].title.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse09.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test10';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse10 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse10.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse10.body.toString());
        expect(obj['data'].targets.targets["0"].uniprot.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse10.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test11';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse11 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse11.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse11.body.toString());
        expect(obj['data'].orthologs.orthologs["0"].species.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse11.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test12';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse12 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse12.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse12.body.toString());
        expect(obj.data.batch.targetResult.facets.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse12.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test13';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse13 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse13.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse13.body.toString());
        expect(obj['data'].diseaseOntology["0"].children["0"].name.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse13.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test14';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse14 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse14.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse14.body.toString());
        expect(obj.data.ligands.ligands["0"].smiles.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse14.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test15';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse15 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse15.statusCode).toBe(200);
    });
    test(testCase + ' should return something meaningful', () => {
        var obj = JSON.parse(testResponse15.body.toString());
        expect(obj.data.dtoNode["0"].parent.name.length > 0).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse15.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });

    testCase = 'test16';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse16 = postit((testContents));
    test(testCase + ' should return success', () => {
        expect(testResponse16.statusCode).toBe(200);
    });
    test(testCase + ' should return actual data', () => {
        var obj = JSON.parse(testResponse16.body.toString());
        expect(!!obj.data.autocomplete).toBe(true);
    });
    test(testCase + ' should have no errors', () => {
        var obj = JSON.parse(testResponse16.body.toString());
        if (!!obj.errors) {
            expect(obj.errors[0].message).toBe(null);
        }
    });
});