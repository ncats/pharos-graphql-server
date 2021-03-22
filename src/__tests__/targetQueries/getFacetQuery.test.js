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

    test('numeric facets work too!', () => {
        const listObj = new TargetList(tcrd, {facets: ["Log Novelty"]});
        const noveltyFacet = listObj.facetsToFetch.find(facet => facet.name === "Log Novelty");
        return noveltyFacet.getFacetQuery().then(res => {
            res.forEach(row => {
                expect(row.bin).toBe(+row.bin);
                expect(row.value % noveltyFacet.binSize).toBe(0);
                expect(row.value).toBeGreaterThanOrEqual(0);
            });
        });
    });

    test('precalculated facets work too!', () => {
        const listObj = new TargetList(tcrd, {facets: ["IMPC Phenotype"]});
        const impc = listObj.facetsToFetch.find(facet => facet.name === "IMPC Phenotype");
        return impc.getFacetQuery().then(res => {
            expect(res.length).toBeGreaterThan(700);
            res.slice(0, 5).forEach(row => {
                expect(row.name).toBeTruthy();
                expect(row.value).toBeGreaterThanOrEqual(0);
            });
        });
    });

    test('precalculated facets with where clauses work too!', () => {
        const listObj = new TargetList(tcrd, {facets: ["Expression: HPA"]});
        const hpa = listObj.facetsToFetch.find(facet => facet.name === "Expression: HPA");
        return hpa.getFacetQuery().then(res => {
            expect(res.length).toBeGreaterThan(100);
            res.slice(0, 5).forEach(row => {
                expect(row.name).toBeTruthy();
                expect(row.value).toBeGreaterThanOrEqual(0);
            });
        });
    });

    test('Facet constraint sometimes have where clauses', () => {
        const listObj = new TargetList(tcrd, {filter: {facets: [{facet: "UniProt Keyword", values: ["Lyase"]}]}});
        const upFacet = listObj.facetsToFetch.find(facet => facet.name === "UniProt Keyword");

        return Promise.all([upFacet.getFacetQuery(), upFacet.getFacetConstraintQuery()]).then(res => {
            const upCount = res[0];
            const proteinList = res[1];
            const lyaseCount = upCount.find(row => row.name == 'Lyase').value;

            expect(proteinList.length).toBe(lyaseCount);

            proteinList.slice(0, 5).forEach(row => {
                expect(row.id).toBeGreaterThan(0);
            });
        });
    });

    test('Virus queries are linky and clausy', () => {
        const listObj = new TargetList(tcrd, {
            filter: {
                facets: [{
                    facet: "Interacting Virus",
                    values: ["Horsepox virus"]
                }]
            }
        });
        const virusFacet = listObj.facetsToFetch.find(facet => facet.name === "Interacting Virus");

        return Promise.all([virusFacet.getFacetQuery(), virusFacet.getFacetConstraintQuery()]).then(res => {
            const countResults = res[0];
            const proteinList = res[1];
            const oneCount = countResults.find(row => row.name == 'Horsepox virus').value;
            expect(proteinList.length).toBe(oneCount);
            proteinList.slice(0, 5).forEach(row => {
                expect(row.id).toBeGreaterThan(0);
            });
        });
    });

    test('filtering by numeric facets!', () => {
        const listObj = new TargetList(tcrd, {filter: {facets: [{facet: "Log Novelty", values: ["[ -5.5, -3.5 )"]}]}});
        const facet = listObj.facetsToFetch.find(facet => facet.name === "Log Novelty");

        return Promise.all([facet.getFacetQuery(), facet.getFacetConstraintQuery()]).then(res => {
            const countResults = res[0];
            const proteinList = res[1];

            const rangeCount = countResults.filter(row => row.bin >= -5.5 && row.bin < -3.5).reduce((a, c) => a + c.value, 0);
            expect(proteinList.length).toBe(rangeCount);
            proteinList.slice(0, 5).forEach(row => {
                expect(row.id).toBeGreaterThan(0);
            });
        });
    });


    test('valuesDelimited boo!', () => {
        const listObj = new TargetList(tcrd, {
            filter: {
                associatedTarget: "ACE2",
                facets: [{facet: "PPI Data Source", values: ["STRINGDB"]}]
            }
        });
        const facet = listObj.facetsToFetch.find(facet => facet.name === "PPI Data Source");

        // console.log(facet.getFacetQuery().toString());
        // console.log(facet.getFacetConstraintQuery().toString());

        return Promise.all([facet.getFacetQuery(), facet.getFacetConstraintQuery()]).then(res => {
            const countResults = res[0];
            const proteinList = res[1];

            const oneCount = countResults.filter(row => row.name && row.name.includes('STRINGDB')).reduce((a, c) => a + c.value, 0);
            expect(proteinList.length).toBe(oneCount);
            proteinList.slice(0, 5).forEach(row => {
                expect(row.id).toBeGreaterThan(0);
            });
        });
    });


    test('facets with an interacting Target!', () => {
        const ppiList = new TargetList(tcrd, {
            filter: {
                associatedTarget: "ACE2"
            }
        });
        const fullList = new TargetList(tcrd, { });

        const ppiFacet = ppiList.facetsToFetch.find(facet => facet.name === "Target Development Level");
        const fullFacet = fullList.facetsToFetch.find(facet => facet.name === "Target Development Level");

        // console.log(ppiFacet.getFacetQuery().toString());
        // console.log(fullFacet.getFacetQuery().toString());

        return Promise.all([ppiFacet.getFacetQuery(), fullFacet.getFacetQuery()]).then(res => {
            const ppiResults = res[0];
            const fullResults = res[1];

            const ppiCount = ppiResults.reduce((a, c) => a + c.value, 0);
            const fullCount = fullResults.reduce((a, c) => a + c.value, 0);

            expect(fullCount).toBeGreaterThan(ppiCount);
        });
    });

    test('filtering by numeric facets, and an associated target!', () => {
        const ppiList = new TargetList(tcrd, {filter: {associatedTarget: "ACE2", facets: [{facet: "Log Novelty", values: ["[ -5.5, -3.5 )"]}]}});
        const ppiFacet = ppiList.facetsToFetch.find(facet => facet.name === "Target Development Level");
        const fullList = new TargetList(tcrd, {filter: {facets: [{facet: "Log Novelty", values: ["[ -5.5, -3.5 )"]}]}});
        const fullFacet = fullList.facetsToFetch.find(facet => facet.name === "Target Development Level");

        // console.log(ppiFacet.getFacetQuery().toString());
        // console.log(fullFacet.getFacetQuery().toString());

        return Promise.all([ppiFacet.getFacetQuery(), fullFacet.getFacetQuery()]).then(res => {
            const ppiResults = res[0];
            const fullResults = res[1];

            const ppiCount = ppiResults.reduce((a, c) => a + c.value, 0);
            const fullCount = fullResults.reduce((a, c) => a + c.value, 0);

            expect(fullCount).toBeGreaterThan(ppiCount);
        });
    });

});
