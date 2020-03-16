const fs = require('fs');
const request = require('sync-request');
const tester = require('graphql-tester').tester;

testDirectory = './tests';
//url = 'https://pharos-api.ncats.io/graphql';
url = 'http://localhost:4000/graphql/';

function postit(query){
    return request('POST', url, {
        json: {query: query},
    });
}

describe('GraphQL API Tests', function() {

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
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse01.statusCode).toBe(200);
    });

    testCase = 'test02';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse02 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse02.statusCode).toBe(200);
    });

    testCase = 'test03';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse03 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse03.statusCode).toBe(200);
    });

    testCase = 'test04';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse04 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse04.statusCode).toBe(200);
    });

    testCase = 'test05';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse05 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse05.statusCode).toBe(200);
    });

    testCase = 'test06';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse06 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse06.statusCode).toBe(200);
    });

    testCase = 'test07';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse07 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse07.statusCode).toBe(200);
    });

    testCase = 'test08';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse08 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse08.statusCode).toBe(200);
    });

    testCase = 'test09';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse09 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse09.statusCode).toBe(200);
    });

    testCase = 'test10';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse10 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse10.statusCode).toBe(200);
    });

    testCase = 'test11';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse11 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse11.statusCode).toBe(200);
    });

    testCase = 'test12';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse12 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse12.statusCode).toBe(200);
    });

    testCase = 'test13';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse13 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse13.statusCode).toBe(200);
    });

    testCase = 'test14';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse14 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse14.statusCode).toBe(200);
    });

    testCase = 'test15';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse15 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse15.statusCode).toBe(200);
    });

    testCase = 'test16';
    testContents = fs.readFileSync(testDirectory + '/' + testCase + '.graphql', 'utf8');
    var testResponse16 = postit((testContents));
    test('test case ' + testCase + ' should return success', () => {
        expect(testResponse16.statusCode).toBe(200);
    });
    test('test case ' + testCase + ' should return actual data', () => {
        expect(hasNonNullRoot(testResponse16,'autocomplete')).toBe(true);
    });
});

function hasNonNullRoot(response,rootName){
    var obj = JSON.parse(response.body.toString());
    return (!!obj['data'][rootName]);
}