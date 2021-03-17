const {TargetList} = require("../models/target/targetList");
const {tcrdConfig} = require('../__utils/loadTCRDforTesting');
const TCRD = require('../TCRD');

let tcrd = new TCRD(tcrdConfig);

beforeAll(() => {
    return tcrd.tableInfo.loadPromise.then((res) => {
        return;
    });
});

describe('list queries should work', function () {
    test('protein - target linking', () => {
        const listObj = new TargetList(tcrd, {
            filter: {facets: [{facet: "Family", values: ["Kinase", "Transcription Factor"]}]},
            top: 10,
            fields: ["Target Development Level", "Family"]
        });
        // console.log(listObj.getListQuery().toString());
        return listObj.getListQuery().then(res => {
            expect(res.length).toBe(10);
            expect(res[0]["Target Development Level"]).toBeTruthy();
            expect(res[0]["Family"]).toBeTruthy();
        });
    });
    test('download query should work with an extra join constraint', () => {
        const listObj = new TargetList(tcrd, {
            filter: {facets: [{facet: "Family", values: ["Kinase", "Transcription Factor"]}]},
            top: 10,
            fields: ["UniProt Keyword"]
        });
        // console.log(listObj.getListQuery().toString());
        return listObj.getListQuery().then(res => {
            expect(res.length).toBe(10);
            expect(res[0]["UniProt Keyword"]).toBeTruthy();
        });
    });
    test('download query should work with duplicated tables', () => {
        const listObj = new TargetList(tcrd, {
            filter: {facets: [{facet: "Data Source", values: ["RCSB Protein Data Bank"]}]},
            top: 10,
            fields: ["UniProt Keyword", "PDB ID"]
        });
        // console.log(listObj.getListQuery().toString());
        return listObj.getListQuery().then(res => {
            expect(res.length).toBe(10);
            expect(res[0]["UniProt Keyword"]).toBeTruthy();
            expect(res[0]["PDB ID"]).toBeTruthy();
        });
    });
    test('group method = count groups and counts', () => {
        const listObj = new TargetList(tcrd, {
            filter: {facets: [{facet: "Family", values: ["Kinase", "Transcription Factor"]}]},
            top: 10,
            fields: ["Family", "UniProt", "PDB Count"]
        });
        // console.log(listObj.getListQuery().toString());
        return listObj.getListQuery().then(res => {
            expect(res.length).toBe(10);
            res.forEach(val => {
                expect(val["UniProt"]).toBeTruthy();
                expect(val["PDB Count"]).toBeGreaterThanOrEqual(0);
            });
        });
    });

    test('list with an associated target', () => {
        const listObj = new TargetList(tcrd, {
            filter: {
                associatedTarget: 'ACE2',
                facets: [{facet: "PPI Data Source", values: ["BioPlex"]}]
            },
            top: 10,
            fields: [
                "UniProt",
                "Symbol",
                "PPI Data Source",
                "StringDB Interaction Score",
                "BioPlex Interaction Probability",
                "BioPlex p_ni",
                "BioPlex p_wrong"]
        });
        // console.log(listObj.getListQuery().toString());
        return listObj.getListQuery().then(res => {
            expect(res.length).toBeGreaterThan(0);
            expect(res[0]["UniProt"]).toBeTruthy();
            expect(res[0]["Symbol"]).toBeTruthy();
            expect(res[0]["PPI Data Source"]).toBeTruthy();
            expect(res[0]["StringDB Interaction Score"]).toBeGreaterThan(0);
            expect(res[0]["BioPlex Interaction Probability"]).toBeGreaterThan(0);
            expect(res[0]["BioPlex p_ni"]).toBeGreaterThan(0);
            expect(res[0]["BioPlex p_wrong"]).toBeGreaterThan(0);
        });
        // expecting data like this, a new TCRD might return something with some nulls
        // RowDataPacket {
        //     id: 16144,
        //         UniProt: 'Q13685',
        //         Symbol: 'AAMP',
        //         'PPI Data Source': 'BioPlex,STRINGDB',
        //         'StringDB Interaction Score': 0.519,
        //         'BioPlex Interaction Probability': 0.821892143,
        //         'BioPlex p_ni': 1.5e-8,
        //         'BioPlex p_wrong': 0.178107842
        // }
    });

});
