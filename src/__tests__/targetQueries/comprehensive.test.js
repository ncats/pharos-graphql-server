const {TargetList} = require("../../models/target/targetList");
const {tcrdConfig} = require('../../__utils/loadTCRDforTesting');
const TCRD = require('../../TCRD');

let tcrd = new TCRD(tcrdConfig);

beforeAll(() => {
    return tcrd.tableInfo.loadPromise.then((res) => {
        return;
    });
});

describe('all the queries should be consistent with each other', function () {
    test('All targets query', () => {
        const fullList = new TargetList(tcrd, {top:1000000});
        const filteredList = new TargetList(tcrd, {filter: {facets: [{facet: "Target Development Level", values: ["Tclin"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullFamFacet = fullList.facetsToFetch.find(facet => facet.name === 'Family');
        const fullFamFacetQuery = fullFamFacet.getFacetQuery();
        const fullTDLFacet = fullList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const fullTDLFacetQuery = fullTDLFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredFamFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Family');
        const filteredFamFacetQuery = filteredFamFacet.getFacetQuery();
        const filteredTDLFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const filteredTDLFacetQuery = filteredTDLFacet.getFacetQuery();
        const filteredTDLConstraintQuery = filteredTDLFacet.getFacetConstraintQuery();

        return Promise.all(
            [fullCountQuery, fullListQuery, fullFamFacetQuery, fullTDLFacetQuery,
                filteredCountQuery, filteredListQuery, filteredFamFacetQuery, filteredTDLFacetQuery,
                filteredTDLConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullFamCount = res[2].reduce((a, c) => a + c.value, 0);
                const fullTDLCount = res[3].reduce((a, c) => a + c.value, 0);
                expect(fullFamCount).toBe(fullListLength);
                expect(fullTDLCount).toBe(fullListLength);

                const filteredCount = res[4][0].count;
                const filteredListLength = res[5].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredFamCount = res[6].reduce((a, c) => a + c.value, 0);
                const filteredTDLCount = res[7].find(row => row.name == 'Tclin').value; // facets don't filter themselves
                expect(filteredFamCount).toBe(filteredListLength);
                expect(filteredTDLCount).toBe(filteredListLength);

                const facetConstraintList = res[8].length;

                expect(facetConstraintList).toBe(filteredListLength);
                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

    test('Search term query', () => {
        const fullList = new TargetList(tcrd, {top:1000000, filter: {term:'cdk'}});
        const filteredList = new TargetList(tcrd, {filter: {term:'cdk', facets: [{facet: "Target Development Level", values: ["Tclin"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullFamFacet = fullList.facetsToFetch.find(facet => facet.name === 'Family');
        const fullFamFacetQuery = fullFamFacet.getFacetQuery();
        const fullTDLFacet = fullList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const fullTDLFacetQuery = fullTDLFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredFamFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Family');
        const filteredFamFacetQuery = filteredFamFacet.getFacetQuery();
        const filteredTDLFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const filteredTDLFacetQuery = filteredTDLFacet.getFacetQuery();
        const filteredTDLConstraintQuery = filteredTDLFacet.getFacetConstraintQuery();


        return Promise.all(
            [fullCountQuery, fullListQuery, fullFamFacetQuery, fullTDLFacetQuery,
                filteredCountQuery, filteredListQuery, filteredFamFacetQuery, filteredTDLFacetQuery,
                filteredTDLConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullFamCount = res[2].reduce((a, c) => a + c.value, 0);
                const fullTDLCount = res[3].reduce((a, c) => a + c.value, 0);
                expect(fullFamCount).toBe(fullListLength);
                expect(fullTDLCount).toBe(fullListLength);

                const filteredCount = res[4][0].count;
                const filteredListLength = res[5].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredFamCount = res[6].reduce((a, c) => a + c.value, 0);
                const filteredTDLCount = res[7].find(row => row.name == 'Tclin').value; // facets don't filter themselves
                expect(filteredFamCount).toBe(filteredListLength);
                expect(filteredTDLCount).toBe(filteredListLength);

                const facetConstraintList = res[8].length;

                // expect(facetConstraintList).toBe(filteredListLength); // not true anymore because the facets are only constraining their one thing
                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

    test('PPI query', () => {
        const fullList = new TargetList(tcrd, {top:1000000, filter: {associatedTarget: "ACE2"}});
        const filteredList = new TargetList(tcrd, {filter: {associatedTarget: "ACE2", facets: [{facet: "Target Development Level", values: ["Tclin"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullFamFacet = fullList.facetsToFetch.find(facet => facet.name === 'Family');
        const fullFamFacetQuery = fullFamFacet.getFacetQuery();
        const fullTDLFacet = fullList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const fullTDLFacetQuery = fullTDLFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredFamFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Family');
        const filteredFamFacetQuery = filteredFamFacet.getFacetQuery();
        const filteredTDLFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const filteredTDLFacetQuery = filteredTDLFacet.getFacetQuery();
        const filteredTDLConstraintQuery = filteredTDLFacet.getFacetConstraintQuery();

        return Promise.all(
            [fullCountQuery, fullListQuery, fullFamFacetQuery, fullTDLFacetQuery,
                filteredCountQuery, filteredListQuery, filteredFamFacetQuery, filteredTDLFacetQuery,
                filteredTDLConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullFamCount = res[2].reduce((a, c) => a + c.value, 0);
                const fullTDLCount = res[3].reduce((a, c) => a + c.value, 0);
                expect(fullFamCount).toBe(fullListLength);
                expect(fullTDLCount).toBe(fullListLength);

                const filteredCount = res[4][0].count;
                const filteredListLength = res[5].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredFamCount = res[6].reduce((a, c) => a + c.value, 0);
                const filteredTDLCount = res[7].find(row => row.name == 'Tclin').value; // facets don't filter themselves
                expect(filteredFamCount).toBe(filteredListLength);
                expect(filteredTDLCount).toBe(filteredListLength);

                const facetConstraintList = res[8].length;

                // expect(facetConstraintList).toBe(filteredListLength); // not true anymore because the facets are only constraining their one thing
                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

    test('Associated Disease query', () => {
        const fullList = new TargetList(tcrd, {top:1000000, filter: {associatedDisease:"carcinoma"}});
        const filteredList = new TargetList(tcrd, {filter: {associatedDisease:"carcinoma", facets: [{facet: "Target Development Level", values: ["Tclin"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullFamFacet = fullList.facetsToFetch.find(facet => facet.name === 'Family');
        const fullFamFacetQuery = fullFamFacet.getFacetQuery();
        const fullTDLFacet = fullList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const fullTDLFacetQuery = fullTDLFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredFamFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Family');
        const filteredFamFacetQuery = filteredFamFacet.getFacetQuery();
        const filteredTDLFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const filteredTDLFacetQuery = filteredTDLFacet.getFacetQuery();
        const filteredTDLConstraintQuery = filteredTDLFacet.getFacetConstraintQuery();

        return Promise.all(
            [fullCountQuery, fullListQuery, fullFamFacetQuery, fullTDLFacetQuery,
                filteredCountQuery, filteredListQuery, filteredFamFacetQuery, filteredTDLFacetQuery,
                filteredTDLConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullFamCount = res[2].reduce((a, c) => a + c.value, 0);
                const fullTDLCount = res[3].reduce((a, c) => a + c.value, 0);
                expect(fullFamCount).toBe(fullListLength);
                expect(fullTDLCount).toBe(fullListLength);

                const filteredCount = res[4][0].count;
                const filteredListLength = res[5].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredFamCount = res[6].reduce((a, c) => a + c.value, 0);
                const filteredTDLCount = res[7].find(row => row.name == 'Tclin').value; // facets don't filter themselves
                expect(filteredFamCount).toBe(filteredListLength);
                expect(filteredTDLCount).toBe(filteredListLength);

                const facetConstraintList = res[8].length;

                // expect(facetConstraintList).toBe(filteredListLength); // not true anymore because the facets are only constraining their one thing
                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

    test('Similarity query', () => {
        const fullList = new TargetList(tcrd, {top:1000000, filter: {similarity: "(Q6P1J9, GWAS)"}});
        const filteredList = new TargetList(tcrd, {filter: {similarity: "(Q6P1J9, GWAS)", facets: [{facet: "Target Development Level", values: ["Tclin"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullFamFacet = fullList.facetsToFetch.find(facet => facet.name === 'Family');
        const fullFamFacetQuery = fullFamFacet.getFacetQuery();
        const fullTDLFacet = fullList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const fullTDLFacetQuery = fullTDLFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredFamFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Family');
        const filteredFamFacetQuery = filteredFamFacet.getFacetQuery();
        const filteredTDLFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Target Development Level');
        const filteredTDLFacetQuery = filteredTDLFacet.getFacetQuery();
        const filteredTDLConstraintQuery = filteredTDLFacet.getFacetConstraintQuery();

        return Promise.all(
            [fullCountQuery, fullListQuery, fullFamFacetQuery, fullTDLFacetQuery,
                filteredCountQuery, filteredListQuery, filteredFamFacetQuery, filteredTDLFacetQuery,
                filteredTDLConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullFamCount = res[2].reduce((a, c) => a + c.value, 0);
                const fullTDLCount = res[3].reduce((a, c) => a + c.value, 0);
                expect(fullFamCount).toBe(fullListLength);
                expect(fullTDLCount).toBe(fullListLength);

                const filteredCount = res[4][0].count;
                const filteredListLength = res[5].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredFamCount = res[6].reduce((a, c) => a + c.value, 0);
                const filteredTDLCount = res[7].find(row => row.name == 'Tclin').value; // facets don't filter themselves
                expect(filteredFamCount).toBe(filteredListLength);
                expect(filteredTDLCount).toBe(filteredListLength);

                const facetConstraintList = res[8].length;

                // expect(facetConstraintList).toBe(filteredListLength); // not true anymore because the facets are only constraining their one thing
                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });
});
