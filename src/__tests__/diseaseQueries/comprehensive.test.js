const {DiseaseList} = require("../../models/disease/diseaseList");
const {tcrdConfig} = require('../../__utils/loadTCRDforTesting');
const TCRD = require('../../TCRD');

let tcrd = new TCRD(tcrdConfig);

beforeAll(() => {
    return tcrd.tableInfo.loadPromise.then((res) => {
        return;
    });
});

describe('all the queries should be consistent with each other', function () {
    test('Disease batches are a thing too', () => {
        const diseaseList = ["asthma", "benign ependymoma"];
        const fullList = new DiseaseList(tcrd);
        const batchList = new DiseaseList(tcrd, {
            batch: diseaseList
        });

        const batchListQuery = batchList.getListQuery('list');
        const batchCountQuery = batchList.getCountQuery();
        const fullTdlFacet = fullList.facetsToFetch.find(f => f.name == 'Highest TDL').getFacetQuery();
        const batchTdlFacet = batchList.facetsToFetch.find(f => f.name == 'Highest TDL').getFacetQuery();

        return Promise.all([batchCountQuery, batchTdlFacet, fullTdlFacet, batchListQuery]).then(res => {
            const batchCount = res[0][0].count;
            expect(batchCount).toBe(diseaseList.length);
            const batchLength = res[3].length;
            expect(batchLength).toBe(diseaseList.length);

            const batchTdlCount = res[1].reduce((a, c) => a + c.value, 0);
            const fullTdlCount = res[2].reduce((a, c) => a + c.value, 0);
            expect(fullTdlCount).toBeGreaterThan(batchTdlCount);
            expect(batchTdlCount).toBeGreaterThan(0);
        });
    });


    test('All diseases query', () => {
        const fullList = new DiseaseList(tcrd);
        const filteredList = new DiseaseList(tcrd, {filter: {facets: [{facet: "Data Source", values: ["CTD"]}]}});

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery('list');
        const fullTypeFacet = fullList.facetsToFetch.find(facet => facet.name === 'Highest TDL');
        const fullTypeFacetQuery = fullTypeFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery('list');
        const filteredTypeFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Highest TDL');
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
                expect(fullTypeCount).toBeGreaterThanOrEqual(fullListLength);

                const filteredCount = res[3][0].count;
                const filteredListLength = res[4].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredTypeCount = res[5].reduce((a, c) => a + c.value, 0);
                expect(filteredTypeCount).toBeGreaterThanOrEqual(filteredListLength);

                const facetConstraintList = res[6].length;

                expect(facetConstraintList).toBe(filteredListLength);
                expect(fullCount).toBeGreaterThan(filteredCount);
                expect(fullTypeCount).toBeGreaterThan(filteredTypeCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });


    test('term search query', () => {
        const fullList = new DiseaseList(tcrd, {top: 20000, filter: {term: "cancer"}});
        const filteredList = new DiseaseList(tcrd, {
            top: 20000,
            filter: {term: "cancer", facets: [{facet: "Data Source", values: ["CTD"]}]}
        });

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery('list');
        const fullTypeFacet = fullList.facetsToFetch.find(facet => facet.name === 'Highest TDL');
        const fullTypeFacetQuery = fullTypeFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery('list');
        const filteredTypeFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Highest TDL');
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
                expect(fullTypeCount).toBeGreaterThanOrEqual(fullListLength);  // only true for TDL because of multiple targets associated with these diseases
                // ideally they'd be equal and add up exactly like in the target / ligand test facets
                const filteredCount = res[3][0].count;
                const filteredListLength = res[4].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredTypeCount = res[5].reduce((a, c) => a + c.value, 0);
                expect(filteredTypeCount).toBeGreaterThanOrEqual(filteredListLength);

                const facetConstraintList = res[6].length;

                // expect(facetConstraintList).toBe(filteredListLength);
                expect(fullCount).toBeGreaterThan(filteredCount);
                expect(fullTypeCount).toBeGreaterThan(filteredTypeCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

    test('associated target query', () => {
        const fullList = new DiseaseList(tcrd, {top: 20000, filter: {associatedTarget: "DRD2"}});
        const filteredList = new DiseaseList(tcrd, {
            top: 20000,
            filter: {associatedTarget: "DRD2", facets: [{facet: "Data Source", values: ["CTD"]}]}
        });

        const fullCountQuery = fullList.getCountQuery();
        const fullListQuery = fullList.getListQuery('list');
        const fullTypeFacet = fullList.facetsToFetch.find(facet => facet.name === 'Drug');
        const fullTypeFacetQuery = fullTypeFacet.getFacetQuery();

        const filteredCountQuery = filteredList.getCountQuery();
        const filteredListQuery = filteredList.getListQuery('list');
        const filteredTypeFacet = filteredList.facetsToFetch.find(facet => facet.name === 'Drug');
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
                // expect(fullTypeCount).toBeGreaterThanOrEqual(fullListLength); // not true for drugs because they are sparse

                const filteredCount = res[3][0].count;
                const filteredListLength = res[4].length;
                expect(filteredCount).toBe(filteredListLength);
                const filteredTypeCount = res[5].reduce((a, c) => a + c.value, 0);
                // expect(filteredTypeCount).toBeGreaterThanOrEqual(filteredListLength);

                const facetConstraintList = res[6].length;

                // expect(facetConstraintList).toBe(filteredListLength);
                expect(fullCount).toBeGreaterThan(filteredCount);
                expect(fullTypeCount).toBeGreaterThan(filteredTypeCount);

                expect(fullCount).toBeGreaterThan(0);
                expect(filteredCount).toBeGreaterThan(0);

                console.log(fullCount);
                console.log(filteredCount);
            });
    });

});
