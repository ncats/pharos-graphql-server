const {LigandList} = require("../../models/ligand/ligandList");
const {tcrdConfig} = require('../../__utils/loadTCRDforTesting');
const TCRD = require('../../TCRD');

let tcrd = new TCRD(tcrdConfig);

beforeAll(() => {
    return tcrd.tableInfo.loadPromise.then((res) => {
        return;
    });
});

describe('all the queries should be consistent with each other', function () {
    test('All ligands query', () => {
        const fullList = new LigandList(tcrd, {top:2669440});
        const filteredList = new LigandList(tcrd, {top:2669440, filter: {facets: [{facet: "Activity", values: ["IC50"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullTypeFacet = fullList.facetsToFetch.find(facet => facet.name === 'Type');
        const fullTypeFacetQuery = fullTypeFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredTypeFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Type');
        const filteredTypeFacetQuery = filteredTypeFacet.getFacetQuery();
        const filteredTypeConstraintQuery = filteredList.filteringFacets[0].getFacetConstraintQuery();

        return Promise.all(
            [fullCountQuery, fullListQuery, fullTypeFacetQuery,
                filteredCountQuery, filteredListQuery, filteredTypeFacetQuery,
                filteredTypeConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullTypeCount = res[2].reduce((a, c) => a + c.value, 0);
                expect(fullTypeCount).toBe(fullListLength);

                const filteredCount = res[3][0].count;
                const filteredListLength = res[4].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredTypeCount = res[5].reduce((a, c) => a + c.value, 0);
                expect(filteredTypeCount).toBe(filteredListLength);

                const facetConstraintList = res[6].length;

                expect(facetConstraintList).toBe(filteredListLength);
                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

    test('Search term query', () => {
        const fullList = new LigandList(tcrd, {top:2669440, filter: {term:'iso'}});
        const filteredList = new LigandList(tcrd, {top:2669440, filter: {term:'iso', facets: [{facet: "Activity", values: ["IC50"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullTypeFacet = fullList.facetsToFetch.find(facet => facet.name === 'Type');
        const fullTypeFacetQuery = fullTypeFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredTypeFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Type');
        const filteredTypeFacetQuery = filteredTypeFacet.getFacetQuery();
        const filteredTypeConstraintQuery = filteredList.filteringFacets[0].getFacetConstraintQuery();

        return Promise.all(
            [fullCountQuery, fullListQuery, fullTypeFacetQuery,
                filteredCountQuery, filteredListQuery, filteredTypeFacetQuery,
                filteredTypeConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullTypeCount = res[2].reduce((a, c) => a + c.value, 0);
                expect(fullTypeCount).toBe(fullListLength);

                const filteredCount = res[3][0].count;
                const filteredListLength = res[4].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredTypeCount = res[5].reduce((a, c) => a + c.value, 0);
                expect(filteredTypeCount).toBe(filteredListLength);

                const facetConstraintList = res[6].length;

                // expect(facetConstraintList).toBe(filteredListLength); // not true anymore because the facets are only constraining their one thing

                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

    test('associated target queries', () => {
        const fullList = new LigandList(tcrd, {top:2669440, filter: {associatedTarget:'ACE2'}});
        const filteredList = new LigandList(tcrd, {top:2669440, filter: {associatedTarget:'ACE2', facets: [{facet: "Activity", values: ["IC50"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery();
        const fullTypeFacet = fullList.facetsToFetch.find(facet => facet.name === 'Type');
        const fullTypeFacetQuery = fullTypeFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery();
        const filteredTypeFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Type');
        const filteredTypeFacetQuery = filteredTypeFacet.getFacetQuery();
        const filteredTypeConstraintQuery = filteredList.filteringFacets[0].getFacetConstraintQuery();

        return Promise.all(
            [fullCountQuery, fullListQuery, fullTypeFacetQuery,
                filteredCountQuery, filteredListQuery, filteredTypeFacetQuery,
                filteredTypeConstraintQuery])
            .then(res => {
                const fullCount = res[0][0].count;
                const fullListLength = res[1].length;
                expect(fullCount).toBe(fullListLength);
                const fullTypeCount = res[2].reduce((a, c) => a + c.value, 0);
                expect(fullTypeCount).toBe(fullListLength);

                const filteredCount = res[3][0].count;
                const filteredListLength = res[4].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredTypeCount = res[5].reduce((a, c) => a + c.value, 0);
                expect(filteredTypeCount).toBe(filteredListLength);

                const facetConstraintList = res[6].length;

                // expect(facetConstraintList).toBe(filteredListLength); // not true anymore because the facets are only constraining their one thing

                expect(fullCount).toBeGreaterThan(filteredCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });
});
