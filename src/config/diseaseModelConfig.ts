import {Field, ModelList, ReadableModel, use} from "./readableConfig";

export class DiseaseModelConfig extends ReadableModel {
    readonly name = 'Disease';
    readonly table = 'ncats_disease';
    readonly keyColumn = 'id';

    readonly symbol = new Field('Symbol', 'protein', 'sym', 'The approved gene symbol', {
        singleResponse: true
    });
    readonly uniprot = new Field('UniProt', 'protein', 'uniprot', 'The UniProt ID for this protein', {
        singleResponse: true
    });
    readonly associatedDisease = new Field(
        'Associated Disease',
        'ncats_disease',
        'name',
        'Diseases found to be associated with targets in the list, based on a documented indication in data from any source.'
    );
    readonly diseaseDataSource = new Field(
        'Disease Data Source',
        'disease',
        'dtype',
        'The data source of the association between disease and target.'
    );
    readonly textMiningZscore = new Field('JensenLab TextMining zscore', 'disease', 'zscore', '', {
        dataType: 'numeric',
        binSize: 0.1
    });
    readonly jensenLabConfidence = new Field(
        'JensenLab Confidence',
        'disease',
        'conf',
        'Metric for the confidence in the disease association, as mined and calculated by <a href="https://diseases.jensenlab.org/Search" target="_blank">DISEASES</a>.',
        {dataType: 'numeric', binSize: 0.1}
    );
    readonly expressionAtlasLog2FoldChange = new Field(
        'Expression Atlas Log2 Fold Change',
        'disease',
        'log2foldchange',
        'Quantified value for the change in expression level of targets in the list in the disease state, as reported by <a href="https://www.ebi.ac.uk/gxa/" target="_blank">Expression Atlas</a>.',
        {dataType: 'numeric', binSize: 0.5}
    );
    readonly disgenetScore = new Field(
        'DisGeNET Score',
        'disease',
        'score',
        'Metric to quantify the disease association, accounting for number of data sources, level of curation, number of publications, etc., as calculated by <a href="https://www.disgenet.org/home/" target="_blank">DisGeNET</a>.',
        {dataType: 'numeric', binSize: 0.02}
    );
    readonly associatedDiseaseEvidence = new Field(
        'Associated Disease Evidence',
        'disease',
        'evidence',
        'A note from the data source regarding the evidence behind the association between disease and target.'
    );
    readonly associatedDiseaseDrugName = new Field(
        'Associated Disease Drug Name',
        'disease',
        'drug_name',
        'Based on data from DrugCentral, these are the names of drugs whose indication has yielded this association between disease and target.'
    );
    readonly associatedDiseasePValue = new Field(
        'Associated Disease P-value',
        'disease',
        'pvalue',
        'The significance of the association between disease and target based on the Expression Atlas log2foldchange.'
    );
    readonly associatedDiseaseSource = new Field(
        'Associated Disease Source',
        'disease',
        'source',
        'A note from DisGeNET or eRAM regarding the dataset which supplied the data.'
    );
    readonly associatedDiseaseSourceId = new Field(
        'Associated Disease Source ID',
        'disease',
        'did',
        'The disease ID used by the data source for this disease association'
    );
    readonly monarchS2O = new Field(
        'Monarch S2O',
        'disease',
        'S2O',
        'A measure from Monarch quantifying the association betweeen disease and target.'
    );

    readonly linkedDisease = new Field(
        'Linked Disease',
        'ncats_disease',
        'name',
        'Diseases linked to targets in the list, which may be descendents of the disease used in the query.'
    );
    readonly diseaseSourceCount = new Field(
        'Disease Source Count',
        'disease',
        'dtype',
        'Count of data sources contributing evidence for the disease - target association',
        {requirement: 'associatedTarget', groupMethod: 'count'}
    );
    readonly proteinCount = new Field(
        'Protein Count',
        'ncats_disease',
        'target_count',
        'Count of proteins associated with the disease, or child diseases',
        {singleResponse: true}
    );
    readonly directAssociationCount = new Field(
        'Direct Association Count',
        'ncats_disease',
        'direct_target_count',
        'Count of proteins documented to be directly associated with the disease, not a child disease',
        {singleResponse: true}
    );
    readonly mondoId = new Field('Mondo ID', 'ncats_disease', 'mondoid', 'Mondo Identifier', {
        singleResponse: true
    });
    readonly gardRare = new Field(
        'GARD Rare',
        'ncats_disease',
        'gard_rare',
        'Annotation from GARD as to whether the disease meets the criteria to be considered a rare disease.',
        {singleResponse: true}
    );

    readonly highestTdl = new Field(
        'Highest TDL',
        'ncats_disease',
        'maxTDL',
        'Maximum development level of targets associated with diseases in the list. The categories are based on the degree to which the targets are studied, as evidenced by publications, tool compounds and other features.',
        {singleResponse: true}
    );
    readonly gardAnnotation = new Field(
        'GARD Annotation',
        'ncats_disease',
        'gard_rare',
        'Annotation from GARD as to whether the disease meets the criteria to be considered a rare disease.',
        {
            select: "case when ncats_disease.gard_rare then 'Rare' end",
            whereClause: 'ncats_disease.gard_rare',
            singleResponse: true
        }
    );
    readonly dataSource = new Field(
        'Data Source',
        'disease',
        'dtype',
        'Data Sources contributing data to the diseases in the list.'
    );
    readonly drug = new Field(
        'Drug',
        'disease',
        'drug_name',
        'Drugs associated with diseases in the list, based on indication data from <a href="https://drugcentral.org/" target="_blank">DrugCentral</a>.',
        {whereClause: 'disease.drug_name is not null'}
    );
    readonly target = new Field(
        'Target',
        'protein',
        'uniprot',
        'Targets to which diseases in the list are known to be associated',
        {select: "concat(protein.description, ' (', protein.uniprot, ')')"}
    );
    readonly diseaseSubtree = new Field(
        'Disease Subtree',
        'ancestry_mondo',
        'ancestor_id',
        'Ancestor terms from MONDO for diseases in the list.',
        {
            select: '(select name from mondo where mondo.mondoid = ancestry_mondo.ancestor_id)',
            filterSelect: 'ancestry_mondo.ancestor_id',
            aliases: ['Disease Ancestry']
        }
    );

    readonly diseaseOntologyDescription = new Field(
        'Disease Ontology Description',
        'ncats_disease',
        'do_description',
        'A description of the disease from Disease Ontology',
        {singleResponse: true}
    );
    readonly uniprotDescription = new Field(
        'UniProt Description',
        'ncats_disease',
        'uniprot_description',
        'A description of the disease from UniProt',
        {singleResponse: true}
    );

    readonly tigaEnsgId = new Field('TIGA ENSG ID', 'tiga', 'ensg', 'Ensembl Gene ID that TIGA uses for this gene');
    readonly efoId = new Field('EFO ID', 'tiga', 'efoid', 'EFO ID for the GWAS trait');
    readonly gwasTrait = new Field('GWAS Trait', 'tiga', 'trait', 'GWAS Trait');
    readonly studyCount = new Field('Study Count', 'tiga', 'n_study', 'Count of studies supporting the gene-trait association');
    readonly snpCount = new Field('SNP Count', 'tiga', 'n_snp', 'Count of SNPs involved with gene-trait association');
    readonly weightedSnpCount = new Field('Weighted SNP Count', 'tiga', 'n_snpw', 'Count of SNPs involved with the gene-trait association, weighted by distance (inverse exponential)');
    readonly traitCountForGene = new Field('Trait Count for Gene', 'tiga', 'geneNtrait', 'Count of traits associated with the gene');
    readonly studyCountForGene = new Field('Study Count for Gene', 'tiga', 'geneNstudy', 'Count of studies associated with the gene');
    readonly geneCountForTrait = new Field('Gene Count for Trait', 'tiga', 'traitNgene', 'Count of genes associated with the trait');
    readonly studyCountForTrait = new Field('Study Count for Trait', 'tiga', 'traitNstudy', 'Count of studies associated with the trait');
    readonly medianPValue = new Field('Median p-value', 'tiga', 'pvalue_mlog_median', 'Median value for -Log(pValue) supporting the gene-trait association');
    readonly medianOddsRatio = new Field('Median Odds Ratio', 'tiga', 'or_median', 'Median Odds Ratio (inverted if < 1 ) that support the gene-trait association');
    readonly betaCount = new Field('Beta Count', 'tiga', 'n_beta', 'Count of beta values with 95% confidence intervals supporting the gene-trait association');
    readonly meanStudyN = new Field('Mean Study N', 'tiga', 'study_N_mean', 'Mean sample size of studies supporting gene-trait association');
    readonly rcras = new Field('RCRAS', 'tiga', 'rcras', 'Relative Citation Ratio (iCite RCR) Aggregated Score');
    readonly meanRank = new Field('Mean Rank', 'tiga', 'meanRank', 'Ranking of gene-trait pairs, based on selected variables, determined by benchmarking versus gold standard associations');
    readonly meanRankScore = new Field('Mean Rank Score', 'tiga', 'meanRankScore', 'Mean Rank Score = 100 - Percentile(Mean Rank)');
    readonly tigaProteinId = new Field('TIGA Protein ID', 'tiga', 'protein_id', 'Internal protein ID of the gene');

    readonly list = new ModelList('list', [
        use(this.linkedDisease, {alias: 'name'}),
        use(this.proteinCount, {alias: 'count'}),
        use(this.directAssociationCount, {alias: 'directAssociationCount'}),
        use(this.mondoId, {alias: 'mondoID'}),
        use(this.gardRare, {alias: 'gard_rare'})
    ]);

    readonly facets = new ModelList('facet', [
        use(this.highestTdl),
        use(this.gardAnnotation),
        use(this.dataSource),
        use(this.drug),
        use(this.target),
        use(this.diseaseSubtree)
    ]);

    readonly search = new ModelList('search', [
        use(this.associatedDisease),
        use(this.uniprotDescription),
        use(this.diseaseOntologyDescription)
    ]);

    readonly downloads = {
        singleValueFields: new ModelList('download', [
            use(this.associatedDisease, {alias: 'Name'}),
            use(this.diseaseOntologyDescription),
            use(this.uniprotDescription),
            use(this.proteinCount),
            use(this.diseaseSourceCount),
            use(this.directAssociationCount),
            use(this.mondoId),
            use(this.gardRare)
        ], {name: 'Single Value Fields'}),
        associatedTargets: new ModelList('download', [
            use(this.symbol),
            use(this.uniprot),
            use(this.associatedDisease, {alias: 'Name'}),
            use(this.diseaseDataSource),
            use(this.textMiningZscore),
            use(this.jensenLabConfidence),
            use(this.expressionAtlasLog2FoldChange),
            use(this.disgenetScore),
            use(this.associatedDiseaseEvidence),
            use(this.associatedDiseaseDrugName),
            use(this.associatedDiseasePValue),
            use(this.associatedDiseaseSource),
            use(this.associatedDiseaseSourceId),
            use(this.monarchS2O)
        ], {name: 'Associated Targets'}),
        tiga: new ModelList('download', [
            use(this.associatedDisease, {alias: 'Name'}),
            use(this.tigaEnsgId),
            use(this.efoId),
            use(this.gwasTrait),
            use(this.studyCount),
            use(this.snpCount),
            use(this.weightedSnpCount),
            use(this.traitCountForGene),
            use(this.studyCountForGene),
            use(this.geneCountForTrait),
            use(this.studyCountForTrait),
            use(this.medianPValue),
            use(this.medianOddsRatio),
            use(this.betaCount),
            use(this.meanStudyN),
            use(this.rcras),
            use(this.meanRank),
            use(this.meanRankScore),
            use(this.tigaProteinId)
        ], {name: 'GWAS Analytics (TIGA)'})
    };

    readonly associatedTarget = {
        list: new ModelList('list', [
            use(this.diseaseDataSource),
            use(this.linkedDisease, {alias: 'name'}),
            use(this.diseaseSourceCount, {alias: 'datasource_count'}),
            use(this.proteinCount, {alias: 'count'}),
            use(this.directAssociationCount, {alias: 'directAssociationCount'}),
            use(this.mondoId, {alias: 'mondoID'}),
            use(this.gardRare, {alias: 'gard_rare'})
        ], {associatedModel: 'Target'}),
        facets: new ModelList('facet', [
            use(this.highestTdl),
            use(this.gardAnnotation),
            use(this.dataSource),
            use(this.drug),
            use(this.target),
            use(this.diseaseSubtree)
        ], {associatedModel: 'Target'})
    };
}

export const diseaseModelConfig = new DiseaseModelConfig();
