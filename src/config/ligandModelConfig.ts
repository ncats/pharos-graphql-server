import {Field, ModelList, ReadableModel, use} from "./readableConfig";

export class LigandModelConfig extends ReadableModel {
    readonly name = "Ligand";
    readonly table = "ncats_ligands";
    readonly keyColumn = "id";

    readonly type = new Field("Type", "ncats_ligands", "isDrug", "Classification as to whether the ligands in the list are approved drugs, or not.", {select: "Case When ncats_ligands.isDrug then 'Drug' else 'Ligand' end", singleResponse: true});
    readonly activity = new Field("Activity", "ncats_ligand_activity", "act_type", "Measurement types recorded for ligands in the list.", {whereClause: "ncats_ligand_activity.act_type not in ('','-')"});
    readonly action = new Field("Action", "ncats_ligand_activity", "action_type", "Modes of action documented for ligands in the list.", {whereClause: "ncats_ligand_activity.action_type is not null"});
    readonly targetCount = new Field("Target Count", "ncats_ligands", "targetCount", "Count of targets the ligand has an activity value for. Note: Counts are limited to 20 so that the plots aren't dominated by outliers with many associated targets.", {select: "least(targetCount, 20)", dataType: "numeric", binSize: 1, singleResponse: true});
    readonly dataSource = new Field("Data Source", "ncats_dataSource_map", "dataSource", "Data Sources contributing data to the ligands in the list.");
    readonly pantherClass = new Field("PANTHER Class", "panther_class", "name", "Classification of active targets for ligands in the list into hierarchical families according to the <a href=\"http://www.pantherdb.org/\" target=\"_blank\">PANTHER classification system</a>.");
    readonly dtoClass = new Field("DTO Class", "dto", "name", "Classification of active targets for ligands in the list into hierarchical families according to the <a href=\"http://drugtargetontology.org/\" target=\"_blank\">Drug Target Ontology</a>.", {whereClause: "dto.name != 'protein'"});
    readonly reactomePathway = new Field("Reactome Pathway", "pathway", "name", "Biochemical pathways for targets with activity against ligands in the list, based on data from <a href=\"http://www.reactome.org/\" target=\"_blank\">Reactome</a>.", {whereClause: "pathway.pwtype = 'Reactome'"});
    readonly target = new Field("Target", "protein", "uniprot", "Targets to which ligands in the list are known to be active", {select: "concat(protein.description, ' (', protein.uniprot, ')')"});
    readonly potency = new Field("Potency", "ncats_ligand_activity", "act_value", "Measured potency values (-log M) for ligands in the list against the associated target. Values may be EC50, IC50, Kd, Ki, or another measure", {dataType: "numeric", binSize: 0.1});
    readonly similarity = new Field("Similarity", "structure_search_results", "similarity", "Tanimoto similarity score between the ligand and the comparison structure.", {schema: "result_cache", dataType: "numeric", binSize: 0.01});
    readonly ligandId = new Field("Ligand ID", "ncats_ligands", "identifier", "An internal ID for the ligand", {singleResponse: true});
    readonly ligandName = new Field("Ligand Name", "ncats_ligands", "name", "The name of the ligand", {singleResponse: true});
    readonly ligandIsDrug = new Field("Ligand Is Drug", "ncats_ligands", "isDrug", "Whether or not the ligand is an approved drug", {singleResponse: true});
    readonly ligandPubchemId = new Field("Ligand PubChem ID", "ncats_ligands", "PubChem", "PubChem ID for the ligand", {singleResponse: true});
    readonly ligandChemblId = new Field("Ligand ChEMBL ID", "ncats_ligands", "ChEMBL", "ChEMBL ID for the ligand", {singleResponse: true});
    readonly ligandGuideToPharmacologyId = new Field("Ligand Guide to Pharmacology ID", "ncats_ligands", "Guide to Pharmacology", "IUPHAR Guide to Pharmacology ID for the ligand", {singleResponse: true});
    readonly ligandDrugcentralId = new Field("Ligand DrugCentral ID", "ncats_ligands", "DrugCentral", "DrugCentral ID for the ligand", {singleResponse: true});
    readonly ligandActivity = new Field("Ligand Activity", "ncats_ligand_activity", "act_value", "Activity value measured for the drug against the given target. Units are -log (M), for example 1nM would correspond to a value of 9.");
    readonly ligandActivityType = new Field("Ligand Activity Type", "ncats_ligand_activity", "act_type", "The type of activity value reported, such as IC50, EC50, Ki, Kd, etc.");
    readonly ligandAction = new Field("Ligand Action", "ncats_ligand_activity", "action_type", "The mode of action for the ligand against the target, such as inhibitor, agonist, blocker, etc.");
    readonly ligandReferences = new Field("Ligand References", "ncats_ligand_activity", "reference", "A reference for the ligand activity against the target");
    readonly ligandReferenceSource = new Field("Ligand Reference Source", "ncats_ligand_activity", "reference_source", "The source for the reference");
    readonly ligandPubmedIds = new Field("Ligand PubMed IDs", "ncats_ligand_activity", "pubmed_ids", "A list of pubmed IDs that provided the ligand activity against the target");
    readonly ligandActivityCount = new Field("Ligand Activity Count", "ncats_ligands", "actCnt", "Count of activity values for the ligand, or the ligand-target pair", {singleResponse: true});
    readonly symbol = new Field("Symbol", "protein", "sym", "The approved gene symbol", {singleResponse: true});
    readonly uniprot = new Field("UniProt", "protein", "uniprot", "The UniProt ID for this protein", {singleResponse: true});
    readonly ligandDescription = new Field("Ligand Description", "ncats_ligands", "description", "A description for the ligand", {singleResponse: true});
    readonly unii = new Field("UNII", "ncats_ligands", "unii", "Unique Ingredient Identifier (UNII) for the substance from GSRS", {singleResponse: true});
    readonly preferredTerm = new Field("Preferred Term", "ncats_ligands", "pt", "The preferred term for the substance", {singleResponse: true});
    readonly ligandSmiles = new Field("Ligand SMILES", "ncats_ligands", "smiles", "SMILES string for the ligand", {singleResponse: true});
    readonly targetCount2 = new Field("Target Count", "ncats_ligands", "targetCount", "Count of targets the ligand has an activity value for.", {dataType: "numeric", binSize: 1, singleResponse: true});

    // Comment facet usages out here when generating cached unfiltered counts
    // for a faster local iteration cycle. Field definitions above can remain.
    readonly facets = new ModelList("facet", [
            use(this.type),
            use(this.activity),
            use(this.action),
            // use(this.targetCount),
            // use(this.dataSource),
            // use(this.pantherClass),
            // use(this.dtoClass),
            // use(this.reactomePathway),
            use(this.target, {default: false})
        ]);

    readonly search = new ModelList("search", [
            use(this.ligandName),
            use(this.ligandPubchemId),
            use(this.ligandChemblId),
            use(this.ligandGuideToPharmacologyId),
            use(this.ligandDrugcentralId),
            use(this.ligandDescription),
            use(this.unii),
            use(this.preferredTerm)
        ]);

    readonly list = new ModelList("list", [
            use(this.ligandId, {alias: "ligid"}),
            use(this.ligandIsDrug, {alias: "isdrug"}),
            use(this.ligandName, {alias: "name"}),
            use(this.ligandSmiles, {alias: "smiles"}),
            use(this.ligandActivityCount, {alias: "actcnt"}),
            use(this.ligandPubchemId, {alias: "PubChem"}),
            use(this.ligandChemblId, {alias: "ChEMBL"}),
            use(this.ligandGuideToPharmacologyId, {alias: "Guide to Pharmacology"}),
            use(this.ligandDrugcentralId, {alias: "DrugCentral"}),
            use(this.ligandDescription, {alias: "description"}),
            use(this.preferredTerm, {alias: "pt"}),
            use(this.unii, {alias: "unii"}),
            use(this.targetCount2, {alias: "targetCount"})
        ]);

    readonly downloads = {
        associatedTargets: new ModelList("download", [
            use(this.ligandId),
            use(this.ligandName),
            use(this.ligandIsDrug),
            use(this.ligandPubchemId),
            use(this.ligandChemblId),
            use(this.ligandGuideToPharmacologyId),
            use(this.ligandDrugcentralId),
            use(this.ligandActivity),
            use(this.ligandActivityType),
            use(this.ligandAction),
            use(this.ligandReferences),
            use(this.ligandReferenceSource),
            use(this.ligandPubmedIds),
            use(this.ligandActivityCount),
            use(this.symbol),
            use(this.uniprot)
        ], {name: "Associated Targets"}),
        singleValueFields: new ModelList("download", [
            use(this.ligandId),
            use(this.ligandName),
            use(this.ligandIsDrug),
            use(this.ligandSmiles),
            use(this.ligandPubchemId),
            use(this.ligandChemblId),
            use(this.ligandGuideToPharmacologyId),
            use(this.ligandDrugcentralId),
            use(this.ligandDescription),
            use(this.ligandActivityCount),
            use(this.preferredTerm),
            use(this.unii)
        ], {name: "Single Value Fields"})
    };

    readonly associatedTarget = {
        facets: new ModelList("facet", [
            use(this.type),
            use(this.activity),
            use(this.target),
            use(this.potency),
            use(this.targetCount),
            use(this.pantherClass),
            use(this.dtoClass),
            use(this.reactomePathway),
            use(this.action),
            use(this.dataSource)
        ], {associatedModel: "Target"})
    };

    readonly associatedLigand = {
        facets: new ModelList("facet", [
            use(this.similarity),
            use(this.type),
            use(this.activity),
            use(this.target),
            use(this.action),
            use(this.targetCount),
            use(this.dataSource),
            use(this.pantherClass),
            use(this.dtoClass),
            use(this.reactomePathway)
        ], {associatedModel: "Ligand"}),
        list: new ModelList("list", [
            use(this.ligandId, {alias: "ligid"}),
            use(this.ligandIsDrug, {alias: "isdrug"}),
            use(this.ligandName, {alias: "name"}),
            use(this.ligandSmiles, {alias: "smiles"}),
            use(this.ligandActivityCount, {alias: "actcnt"}),
            use(this.ligandPubchemId, {alias: "PubChem"}),
            use(this.ligandChemblId, {alias: "ChEMBL"}),
            use(this.ligandGuideToPharmacologyId, {alias: "Guide to Pharmacology"}),
            use(this.ligandDrugcentralId, {alias: "DrugCentral"}),
            use(this.ligandDescription, {alias: "description"}),
            use(this.preferredTerm, {alias: "pt"}),
            use(this.unii, {alias: "unii"}),
            use(this.similarity, {alias: "similarity"}),
            use(this.targetCount2, {alias: "targetCount"})
        ], {associatedModel: "Ligand"}),
        singleValueFields: new ModelList("download", [
            use(this.similarity)
        ], {name: "Single Value Fields", associatedModel: "Ligand"})
    };

}

export const ligandModelConfig = new LigandModelConfig();
