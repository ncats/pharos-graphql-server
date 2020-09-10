class dataSource:
    def __init__(self, source, url, license, licenseURL, mappings):
        self.source = source
        self.url = url
        self.license = license
        self.licenseURL = licenseURL
        self.mappings = mappings

class mapping:
    def __init__(self, destinationTable, idQuery):
        self.destinationTable = destinationTable
        self.idQuery = idQuery

url = ""
license = ""
licenseURL = ""

dataSourceMapping = [
    dataSource("Antibodypedia", "https://www.antibodypedia.com/", license, licenseURL,  [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE integer_value > 0 AND itype = 'Ab Count'")
    ]),
    dataSource("Animal TFDB", "http://bioinfo.life.hust.edu.cn/AnimalTFDB/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'Is Transcription Factor' and boolean_value = 1")
    ]),
    dataSource("BioPlex Protein-Protein Interactions", "https://bioplex.hms.harvard.edu/", license, licenseURL, [
        mapping("protein", "SELECT protein1_id AS protein_id FROM ppi WHERE ppitype = 'BioPlex' UNION SELECT protein2_id AS protein_id FROM ppi WHERE ppitype = 'BioPlex'")
    ]),
    dataSource("CCLE", "https://portals.broadinstitute.org/ccle", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM expression WHERE etype = 'CCLE'")
    ]),
    dataSource("Cell Surface Protein Atlas", "http://wlab.ethz.ch/cspa/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM expression WHERE etype = 'Cell Surface Protein Atlas'")
    ]),
    dataSource("ChEMBL", "https://www.ebi.ac.uk/chembl/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM cmpd_activity, t2tc WHERE catype = 'ChEMBL' AND t2tc.target_id = cmpd_activity.target_id ORDER BY protein_id"),
        mapping("ligand", "SELECT id FROM ncats_ligands where ChEMBL is not null ORDER BY id")
    ]),
    dataSource("ClinVar", "https://www.ncbi.nlm.nih.gov/clinvar/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM clinvar")
    ]),
    dataSource("Consensus Expression Values", url, license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM expression WHERE etype = 'Consensus'")
    ]),
    dataSource("CTD", "https://ctdbase.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'CTD'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'CTD'")
    ]),
    dataSource("Disease Ontology", "http://www.disease-ontology.org/", license, licenseURL, [
        mapping("disease","SELECT DISTINCT name FROM do")
    ]),
    dataSource("DisGeNET", "http://www.disgenet.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'DisGeNET'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'DisGeNET'")
    ]),
    # This one isn't really how we fetch DRGC resources anymore
    dataSource("DRGC Resources", "https://rss.ccs.miami.edu/rss-apis/", license, licenseURL, []),
    dataSource("Drug Central Indication", "http://drugcentral.org", license, licenseURL, [ # don't change spelling of disease dataSources!
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'DrugCentral Indication'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'DrugCentral Indication'")
        ]),
    dataSource("Drug Central - Scientific Literature", "http://drugcentral.org/", license, licenseURL, [
        mapping("ligand", "SELECT DISTINCT protein_id FROM drug_activity, t2tc where source = 'SCIENTIFIC LITERATURE' and t2tc.target_id = drug_activity.target_id")
    ]),
    dataSource("Drug Central - Drug Label", "http://drugcentral.org/", license, licenseURL, [
        mapping("ligand", "SELECT DISTINCT protein_id FROM drug_activity, t2tc where source = 'DRUG LABEL' and t2tc.target_id = drug_activity.target_id")
    ]),
    dataSource("Drug Central - Kegg Drug", "http://drugcentral.org/", license, licenseURL, [
        mapping("ligand", "SELECT DISTINCT protein_id FROM drug_activity, t2tc where source = 'KEGG DRUG' and t2tc.target_id = drug_activity.target_id")
    ]),
    dataSource("Drug Central - IUPHAR", "http://drugcentral.org/", license, licenseURL, [
        mapping("ligand", "SELECT DISTINCT protein_id FROM drug_activity, t2tc where source = 'IUPHAR' and t2tc.target_id = drug_activity.target_id")
    ]),
    dataSource("Drug Central - ChEMBL", "http://drugcentral.org/", license, licenseURL, [
        mapping("ligand", "SELECT DISTINCT protein_id FROM drug_activity, t2tc where source = 'CHEMBL' and t2tc.target_id = drug_activity.target_id")
    ]),
    dataSource("Drug Target Ontology IDs and Classifications", "http://drugtargetontology.org/", license, licenseURL, [
        mapping("protein", "SELECT id FROM protein WHERE dtoid is not null")
    ]),
    dataSource("EBI Patent Counts", "https://www.ebi.ac.uk/patentdata/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM patent_count")
    ]),
    dataSource("Ensembl Gene IDs", "https://uswest.ensembl.org/index.html", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM xref WHERE xtype = 'ENSG'")
    ]),
    dataSource("eRAM", "http://www.unimd.org/eram/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'eRAM'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'eRAM'")
    ]),
    dataSource("Expression Atlas", "https://www.ebi.ac.uk/gxa/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'Expression Atlas'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'Expression Atlas'")
    ]),
    dataSource("Gene Ontology", "http://geneontology.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'Experimental MF/BP Leaf Term GOA'")
    ]),
    dataSource("GTEx", "http://www.gtexportal.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM gtex")
    ]),
    dataSource("Guide to Pharmacology", "https://www.guidetopharmacology.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM cmpd_activity, t2tc WHERE t2tc.target_id = cmpd_activity.target_id AND catype = 'Guide to Pharmacology'")
        ,mapping('ligand', "SELECT id FROM ncats_ligands where `Guide to Pharmacology` is not null")
    ]),
    dataSource("GWAS Catalog", "https://www.ebi.ac.uk/gwas/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM gwas")
    ]),
    dataSource("Harmonizome", "http://amp.pharm.mssm.edu/Harmonizome/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM gene_attribute")
    ]),
    dataSource("Harmonogram CDFs", "http://amp.pharm.mssm.edu/Harmonizome/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM hgram_cdf")
    ]),
    dataSource("HGNC", "https://www.genenames.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM xref WHERE xtype = 'HGNC'")
    ]),
    dataSource("HomoloGene", "https://www.ncbi.nlm.nih.gov/homologene", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM homologene")
    ]),
    dataSource("Human Cell Atlas Compartments", "https://www.humancellatlas.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM compartment WHERE ctype = 'Human Cell Atlas'")
    ]),
    dataSource("Human Cell Atlas Expression", "https://www.humancellatlas.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM expression WHERE etype = 'HCA RNA'")
    ]),
    dataSource("Human Protein Atlas", "https://www.proteinatlas.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM expression WHERE etype = 'HPA'")
    ]),
    dataSource("Human Proteome Map", "https://www.humanproteomemap.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM expression WHERE etype = 'HPM Protein' or etype = 'HPM Gene'")
    ]),
    dataSource("IDG Eligible Targets List", url, license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM ncats_idg_list")
    ]),
    dataSource("IDG Families", url, license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM target, t2tc WHERE t2tc.target_id = target.id AND target.fam is not null")
    ]),
    dataSource("IMPC Mouse Clones", "https://www.mousephenotype.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'IMPC Clones'")
    ]),
    dataSource("IMPC Phenotypes", "https://www.mousephenotype.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein.id FROM nhprotein, phenotype, ortholog, protein WHERE ortholog.geneid = nhprotein.geneid AND ortholog.taxid = nhprotein.taxid AND nhprotein.id = phenotype.nhprotein_id AND protein.id = ortholog.protein_id AND phenotype.ptype = 'IMPC'")
    ]),
    dataSource("JAX/MGI Mouse/Human Orthology Phenotypes", "http://www.informatics.jax.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM phenotype WHERE ptype = 'JAX/MGI Human Ortholog Phenotype'")
    ]),
    dataSource("JensenLab COMPARTMENTS", "https://compartments.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM compartment WHERE ctype like 'JensenLab%'")
    ]),
    dataSource("JensenLab Experiment COSMIC", "https://diseases.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'JensenLab Experiment COSMIC'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'JensenLab Experiment COSMIC'")
    ]),
    dataSource("JensenLab Experiment DistiLD", "https://diseases.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'JensenLab Experiment DistiLD'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'JensenLab Experiment DistiLD'")
    ]),
    dataSource("JensenLab Knowledge GHR", "https://diseases.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'JensenLab Knowledge GHR'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'JensenLab Knowledge GHR'")
    ]),
    dataSource("JensenLab Knowledge UniProtKB-KW", "https://diseases.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'JensenLab Knowledge UniProtKB-KW'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'JensenLab Knowledge UniProtKB-KW'")
    ]),
    dataSource("JensenLab Text Mining", "https://diseases.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'JensenLab Text Mining'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'JensenLab Text Mining'")
    ]),
    dataSource("JensenLab TISSUES", "https://tissues.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM expression WHERE etype like 'JENSENLAB %'")
    ]),
    dataSource("JensenLab PubMed Text-mining Scores", "https://diseases.jensenlab.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'JensenLab PubMed Score' and number_value > 0")
    ]),
    dataSource("KEGG Pathways", "https://www.genome.jp/kegg/pathway.html", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM pathway WHERE pwtype = 'KEGG'")
    ]),
    dataSource("KEGG Distances", url, license, licenseURL, [
        mapping("protein", "SELECT pid1 as pid FROM kegg_distance UNION SELECT pid2 as pid FROM kegg_distance")
    ]),
    dataSource("KEGG Nearest Tclins", url, license, licenseURL, [
        mapping("protein", "SELECT protein_id as pid FROM kegg_nearest_tclin UNION SELECT t2tc.protein_id as pid FROM kegg_nearest_tclin, t2tc WHERE tclin_id = t2tc.target_id")
    ]),
    dataSource("LINCS", "http://www.lincsproject.org/LINCS/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM lincs")
    ]),
    dataSource("LINCS L1000 XRefs", "http://www.lincsproject.org/LINCS/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM xref WHERE xtype = 'L1000 ID'")
    ]),
    dataSource("LocSigDB", "http://genome.unmc.edu/LocSigDB/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM locsig")
    ]),
    dataSource("Monarch", "https://monarchinitiative.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'Monarch'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'Monarch'")
    ]),
    dataSource("Monarch Ortholog Disease Associations", "https://monarchinitiative.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM ortholog_disease")
        ,mapping("disease","SELECT DISTINCT name FROM ortholog_disease")
    ]),
    dataSource("NCBI Gene", "https://www.ncbi.nlm.nih.gov/gene/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM alias WHERE dataset_id = 7 UNION SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'NCBI Gene Summary' UNION SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'NCBI Gene PubMed Count' UNION SELECT DISTINCT protein_id FROM xref WHERE xtype = 'PubMed'")
    ]),
    dataSource("NCBI GI Numbers", url, license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM xref WHERE xtype = 'NCBI GI'")
    ]),
    dataSource("OMIM", "https://www.ncbi.nlm.nih.gov/omim", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM phenotype WHERE ptype = 'OMIM'")
    ]),
    dataSource("Orthologs", "https://www.genenames.org/tools/hcop/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM ortholog")
    ]),
    dataSource("p-hipster viral PPIs", "http://phipster.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM viral_ppi")
    ]),
    dataSource("PANTHER protein classes", "http://www.pantherdb.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM p2pc")
    ]),
    dataSource("PathwayCommons", "https://www.pathwaycommons.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM pathway WHERE pwtype like 'PathwayCommons%'")
    ]),
    dataSource("PubChem CIDs", "https://pubchem.ncbi.nlm.nih.gov/", license, licenseURL, [
        mapping("ligand","SELECT id FROM ncats_ligands WHERE PubChem is not null")
    ]),
    dataSource("PubMed", "https://pubmed.ncbi.nlm.nih.gov/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM protein2pubmed")
    ]),
    dataSource("PubTator Text-mining Scores", "https://www.ncbi.nlm.nih.gov/research/pubtator/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'PubTator Score'")
    ]),
    dataSource("RCSB Protein Data Bank", "https://www.rcsb.org/", license, licenseURL, [
        mapping("protein", "SELECT distinct protein_id FROM xref where xtype = 'PDB'")
    ]),
    dataSource("Reactome Pathways", "https://reactome.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM pathway WHERE pwtype = 'Reactome'")
    ]),
    dataSource("Reactome Protein-Protein Interactions", "https://reactome.org/", license, licenseURL, [
        mapping("protein", "SELECT protein1_id as protein_id FROM ppi WHERE ppitype = 'Reactome' UNION SELECT protein2_id as protein_id FROM ppi WHERE ppitype = 'Reactome'")
    ]),
    dataSource("RGD", "https://rgd.mcw.edu/rgdweb/homepage/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein.id FROM nhprotein, rat_qtl, ortholog, protein WHERE ortholog.geneid = nhprotein.geneid AND ortholog.taxid = nhprotein.taxid AND nhprotein.id = rat_qtl.nhprotein_id AND protein.id = ortholog.protein_id")
    ]),
    dataSource("STRING IDs", "https://string-db.org/", license, licenseURL, [
        mapping("protein", "SELECT id FROM protein WHERE stringid is not null")
    ]),
    dataSource("STRINGDB", "https://string-db.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein1_id FROM ppi WHERE ppitype = 'STRINGDB'")
    ]),
    dataSource("TIN-X Data", "https://www.newdrugtargets.org/", license, licenseURL, [
        mapping("protein", "SELECT protein_id FROM tinx_novelty UNION SELECT protein_id FROM tinx_importance")
        ,mapping("disease","SELECT DISTINCT name FROM tinx_disease")
    ]),
    dataSource("TMHMM Predictions", "https://www.uniprot.org/uniprot/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'TMHMM Prediction'")
    ]),
    dataSource("Transcription Factor Flags", "http://humantfs.ccbr.utoronto.ca/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM tdl_info WHERE itype = 'Is Transcription Factor'")
    ]),
    dataSource("UniProt", "https://www.uniprot.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM xref WHERE xtype='UniProt Keyword'")
    ]),
    dataSource("UniProt Disease", "https://www.uniprot.org/", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM disease WHERE dtype = 'UniProt Disease'")
        ,mapping("disease","SELECT DISTINCT ncats_name FROM disease WHERE dtype = 'UniProt Disease'")
    ]),
    dataSource("WikiPathways", "https://www.wikipathways.org/index.php/WikiPathways", license, licenseURL, [
        mapping("protein", "SELECT DISTINCT protein_id FROM pathway WHERE pwtype = 'WikiPathways'")
    ])
]
