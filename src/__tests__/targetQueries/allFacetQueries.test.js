const {TargetList} = require("../../models/target/targetList");
const {tcrdConfig} = require('../../__utils/loadTCRDforTesting');
const TCRD = require('../../TCRD');

let tcrd = new TCRD(tcrdConfig);

let allTargets;
let filteredTargets;

beforeAll(() => {
    return tcrd.tableInfo.loadPromise.then(() => {
        allTargets = new TargetList(tcrd, {facets: "all"});
        filteredTargets = new TargetList(tcrd, {
            facets: "all", filter: {
                facets: [
                    {facet: "Family", values: ["Kinase"]},
                    {facet: "Target Development Level", values: ["Tclin"]}
                ]
            }
        });
    })
});

describe('all facets should work', function () {

    test('there should be facets', () => {
        expect(allTargets.facetsToFetch.length).toBeGreaterThan(35);
    });

    [
        "Target Development Level",
        "IDG Target Lists",
        "UniProt Keyword",
        "Family",
        "Indication",
        "Monarch Disease",
        "UniProt Disease",
        "Ortholog",
        // "IMPC Phenotype",
        "GO Component",
        "GO Process",
        "JAX/MGI Phenotype",
        "GO Function",
        "GWAS",
        "Expression: HPA",
        "Expression: JensenLab Experiment HPA",
        "Expression: HPM Gene",
        "Expression: JensenLab Experiment Exon array",
        "Expression: Consensus",
        "Expression: JensenLab Experiment GNF",
        "Expression: JensenLab Experiment HPA-RNA",
        "Expression: JensenLab Experiment RNA-seq",
        "Expression: JensenLab Experiment UniGene",
        "Expression: UniProt Tissue",
        "Expression: JensenLab Experiment Cardiac proteome",
        "Expression: JensenLab Text Mining",
        "Expression: JensenLab Knowledge UniProtKB-RC",
        "Expression: Cell Surface Protein Atlas",
        "Reactome Pathway",
        "WikiPathways Pathway",
        "KEGG Pathway",
        "Interacting Viral Protein",
        "Interacting Virus",
        "Log Novelty",
        "Log PubMed Score",
        "Data Source",
        "UniProt Pathway",
        "PathwayCommons Pathway",
        "PANTHER Class",
        "DTO Class"
    ].forEach(facetType => {
        test(`${facetType} should work`, () => {
            const fullFacet = allTargets.facetsToFetch.find(f => f.name == facetType);
            const filteredFacet = filteredTargets.facetsToFetch.find(f => f.name == facetType);
            return Promise.all([fullFacet.getFacetQuery(), filteredFacet.getFacetQuery()]).then(res => {
                const fullCounts = res[0];
                const filteredCounts = res[1];

                const fullTotal = fullCounts.reduce((a, c) => a + c.value, 0);
                const filteredTotal = filteredCounts.reduce((a, c) => a + c.value, 0);

                expect(fullTotal).toBeGreaterThan(0);
                expect(filteredTotal).toBeGreaterThan(0);
                expect(fullTotal).toBeGreaterThan(filteredTotal);
            });
        });
    });
});
