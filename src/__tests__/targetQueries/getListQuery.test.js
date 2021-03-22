const {TargetList} = require("../../models/target/targetList");
const {tcrdConfig} = require('../../__utils/loadTCRDforTesting');
const TCRD = require('../../TCRD');

let tcrd = new TCRD(tcrdConfig);

beforeAll(() => {
    return tcrd.tableInfo.loadPromise.then((res) => {
        return;
    });
});

describe('list queries should work', function () {
    test('download query should work with duplicated tables', () => {
        const listObj = new TargetList(tcrd, {
            filter: {facets: [{facet: "Data Source", values: ["RCSB Protein Data Bank"]}]},
            top: 10,
            fields: ["UniProt Keyword", "PDB IDs"]
        });
        // console.log(listObj.getListQuery().toString());
        return listObj.getListQuery().then(res => {
            expect(res.length).toBe(10);
            expect(res[0]["UniProt Keyword"]).toBeTruthy();
            expect(res[0]["PDB IDs"]).toBeTruthy();
        });
    });
    test('group method = count groups and counts', () => {
        const listObj = new TargetList(tcrd, {
            filter: {facets: [{facet: "Family", values: ["Kinase", "Transcription Factor"]}, {facet: "Data Source", values: ["RCSB Protein Data Bank"]}]},
            top: 10,
            fields: ["Family", "UniProt", "PDB IDs"]
        });
        console.log(listObj.getListQuery().toString());
        return listObj.getListQuery().then(res => {
            expect(res.length).toBe(10);
            res.forEach(val => {
                expect(val["UniProt"]).toBeTruthy();
                expect(val["PDB IDs"].length).toBeGreaterThan(0);
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
        console.log(listObj.getListQuery().toString());
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
    });


    test('Sorting by a column that isnt normally there', () => {
        const descendingList = new TargetList(tcrd, {
            top: 10,
            filter: {
                associatedTarget: "ACE2",
                order: "!Antibody Count"
            }
        });
        const ascendingList = new TargetList(tcrd, {
            top: 10,
            filter: {
                associatedTarget: 'ACE2',
                order: "^Antibody Count"
            }
        });
        const descQuery = descendingList.getListQuery();
        const ascQuery = ascendingList.getListQuery();
        return Promise.all([descQuery, ascQuery]).then(res => {
            const descRes = res[0].map(r => r['Antibody Count']);
            const ascRes = res[1].map(r => r['Antibody Count']);
            expect(descRes.length).toBe(10);
            expect(ascRes.length).toBe(10);
            let lastDescVal = descRes[0];
            let lastAscVal = ascRes[0];
            for (let i = 1; i < 10; i++) {
                const nextDescVal = descRes[i];
                const nextAscVal = ascRes[i];
                expect(nextDescVal).toBeLessThanOrEqual(lastDescVal);
                expect(nextAscVal).toBeGreaterThanOrEqual(lastAscVal);
                lastDescVal = nextDescVal;
                lastAscVal = nextAscVal;
            }
        })
    });

    test('target batches are a thing', () => {
        const proteinList = ["Q13619", "Q13616", "P06493", "Q92879", "GPR85", "ACE2"];
        const batchList = new TargetList(tcrd, {
            batch: proteinList
        });
        const listQuery = batchList.getListQuery();
        const tdlFacet = batchList.facetsToFetch.find(f => f.name == 'Target Development Level').getFacetQuery();
        const famFacet = batchList.facetsToFetch.find(f => f.name == 'Family').getFacetQuery();
        const countQuery = batchList.getCountQuery();

        return Promise.all([countQuery, listQuery, tdlFacet, famFacet]).then(res => {
            const resultCount = res[0][0].count;
            const listLength = res[1].length;
            const tdlCount = res[2].reduce((a, c) => a + c.value, 0);
            const famCount = res[3].reduce((a, c) => a + c.value, 0);
            expect(resultCount).toBe(proteinList.length);
            expect(listLength).toBe(proteinList.length);
            expect(tdlCount).toBe(proteinList.length);
            expect(famCount).toBe(proteinList.length);

            res[1].forEach(row => {
                const foundSymbol = proteinList.includes(row.sym);
                const foundUniProt = proteinList.includes(row.uniprot);
                expect(foundSymbol || foundUniProt).toBe(true);
            });
        })
    });
});
