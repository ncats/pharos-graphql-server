import {TargetFacetType} from "./targetFacetType";
import {DataModelList} from "../DataModelList";
import {FacetInfo} from "../FacetInfo";
import {FacetFactory} from "../FacetFactory";
import {DiseaseList} from "../disease/diseaseList";

export class TargetFacetFactory extends FacetFactory{

    GetFacet(parent: DataModelList, typeName: string, allowedValues: string[], nullQuery: boolean = false): FacetInfo {
        const partialReturn = {
            type: typeName,
            parent: parent,
            allowedValues: allowedValues
        };
        const type: TargetFacetType = (<any>TargetFacetType)[typeName];
        switch (type) {
            case TargetFacetType["Target Development Level"]:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "target",
                        dataColumn: "tdl"
                    } as FacetInfo);
            case TargetFacetType.Family:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "target",
                        dataColumn: "fam",
                        select: `case target.fam 
                                        when 'IC' then 'Ion Channel' 
                                        when 'TF; Epigenetic' then 'TF-Epigenetic' 
                                        when 'TF' then 'Transcription Factor' 
                                        when 'NR' then 'Nuclear Receptor' 
                                        else if(target.fam is null,'Other',target.fam) end`,
                        groupBy: "name"
                    } as FacetInfo);
            case TargetFacetType["UniProt Keyword"]:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "xref",
                        dataColumn: "xtra",
                        whereClause: "xref.xtype = 'UniProt Keyword'"
                    } as FacetInfo);
            case TargetFacetType["UniProt Disease"]:
            case TargetFacetType.Indication:
            case TargetFacetType["Monarch Disease"]:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "disease",
                        dataColumn: "name",
                        whereClause: `disease.dtype = '${TargetFacetFactory.getExtraParam(typeName)}'`
                    } as FacetInfo);
            case TargetFacetType.Ortholog:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "ortholog",
                        dataColumn: "species"
                    } as FacetInfo);
            case TargetFacetType["JAX/MGI Phenotype"]:
                return new FacetInfo(
                    {
                        ...partialReturn,
                        dataTable: "phenotype",
                        dataColumn: "term_name",
                        whereClause: `phenotype.ptype = 'JAX/MGI Human Ortholog Phenotype'`
                    } as FacetInfo);
            case TargetFacetType["GO Component"]:
            case TargetFacetType["GO Function"]:
            case TargetFacetType["GO Process"]:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "goa",
                    dataColumn: "go_term",
                    select: `substr(go_term,3)`,
                    whereClause: `substr(go_term,1,1) = '${TargetFacetFactory.getExtraParam(typeName)}'`
                } as FacetInfo);
            case TargetFacetType.GWAS:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "gwas",
                    dataColumn: "disease_trait"
                } as FacetInfo);
            case TargetFacetType["IDG Target Lists"]:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "ncats_idg_list_type",
                    dataColumn: "list_type"
                } as FacetInfo);
            case TargetFacetType["IMPC Phenotype"]:
                if (nullQuery) {
                    return new FacetInfo({
                        ...partialReturn,
                        dataTable: "ncats_facet_impc",
                        dataColumn: "name",
                        countColumn: "value"
                    } as FacetInfo);
                } else {
                    return new FacetInfo({
                        ...partialReturn,
                        dataTable: "phenotype",
                        dataColumn: "term_name",
                        whereClause: "phenotype.ptype = 'IMPC' and phenotype.p_value < 0.05"
                    } as FacetInfo);
                }
            case TargetFacetType["Expression: CCLE"]:
            case TargetFacetType["Expression: Cell Surface Protein Atlas"]:
            case TargetFacetType["Expression: Consensus"]:
            case TargetFacetType["Expression: HCA RNA"]:
            case TargetFacetType["Expression: HPA"]:
            case TargetFacetType["Expression: HPM Gene"]:
            case TargetFacetType["Expression: HPM Protein"]:
            case TargetFacetType["Expression: JensenLab Experiment Cardiac proteome"]:
            case TargetFacetType["Expression: JensenLab Experiment Exon array"]:
            case TargetFacetType["Expression: JensenLab Experiment GNF"]:
            case TargetFacetType["Expression: JensenLab Experiment HPA"]:
            case TargetFacetType["Expression: JensenLab Experiment HPA-RNA"]:
            case TargetFacetType["Expression: JensenLab Experiment RNA-seq"]:
            case TargetFacetType["Expression: JensenLab Experiment UniGene"]:
            case TargetFacetType["Expression: JensenLab Knowledge UniProtKB-RC"]:
            case TargetFacetType["Expression: JensenLab Text Mining"]:
            case TargetFacetType["Expression: UniProt Tissue"]:
                if (nullQuery) {
                    return new FacetInfo({
                        ...partialReturn,
                        dataTable: "ncats_facet_expression",
                        dataColumn: "name",
                        countColumn: "value",
                        whereClause: `ncats_facet_expression.etype = '${TargetFacetFactory.getExtraParam(typeName)}'`
                    } as FacetInfo);
                } else {
                    return new FacetInfo({
                        ...partialReturn,
                        dataTable: "expression",
                        dataColumn: "tissue",
                        whereClause: `expression.etype = '${TargetFacetFactory.getExtraParam(typeName)}'`
                    } as FacetInfo);
                }
            case TargetFacetType["WikiPathways Pathway"]:
            case TargetFacetType["KEGG Pathway"]:
            case TargetFacetType["Reactome Pathway"]:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "pathway",
                    dataColumn: "name",
                    whereClause: `pathway.pwtype = '${TargetFacetFactory.getExtraParam(typeName)}'`
                } as FacetInfo);
            case TargetFacetType["PPI Data Source"]:
                if(!parent.associatedTarget) { return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    dataTable:"ncats_ppi",
                    dataColumn: "ppitypes",
                    whereClause: `other_id = (select id from protein where match(uniprot,sym,stringid) against('${parent.associatedTarget}' in boolean mode))`,
                    valuesDelimited: true
                } as FacetInfo);
            case TargetFacetType["Disease Data Source"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "disease",
                    dataColumn: "dtype",
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`,
                    // valuesDelimited: true
                } as FacetInfo);
            case TargetFacetType["Linked Disease"]:
                if(!parent.associatedDisease) {return this.unknownFacet();}
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "disease",
                    dataColumn: "ncats_name",
                    whereClause: `disease.ncats_name in (${DiseaseList.getDescendentsQuery(parent.database, parent.associatedDisease).toString()})`,
                    // valuesDelimited: true
                } as FacetInfo);
            case TargetFacetType["Interacting Viral Protein (Virus)"]:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "viral_protein",
                    dataColumn: "ncbi",
                    select: `concat(viral_protein.name, ' (', virus.name, ')')`
                } as FacetInfo);
            case TargetFacetType["Interacting Virus"]:
                return new FacetInfo({
                    ...partialReturn,
                    dataTable: "virus",
                    dataColumn: "name"
                } as FacetInfo);
        }
        return this.unknownFacet();
    }


    static getExtraParam(type: string) {
        switch (type) {
            case "Indication":
                return "DrugCentral Indication";
            case "Monarch Disease":
                return "Monarch";
            case "GO Component":
                return "C";
            case "GO Function":
                return "F";
            case "GO Process":
                return "P";
            case "Expression: CCLE":
                return "CCLE";
            case "Expression: Cell Surface Protein Atlas":
                return "Cell Surface Protein Atlas";
            case "Expression: Consensus":
                return "Consensus";
            case "Expression: HCA RNA":
                return "HCA RNA";
            case "Expression: HPA":
                return "HPA";
            case "Expression: HPM Gene":
                return "HPM Gene";
            case "Expression: HPM Protein":
                return "HPM Protein";
            case "Expression: JensenLab Experiment Cardiac proteome":
                return "JensenLab Experiment Cardiac proteome";
            case "Expression: JensenLab Experiment Exon array":
                return "JensenLab Experiment Exon array";
            case "Expression: JensenLab Experiment GNF":
                return "JensenLab Experiment GNF";
            case "Expression: JensenLab Experiment HPA":
                return "JensenLab Experiment HPA";
            case "Expression: JensenLab Experiment HPA-RNA":
                return "JensenLab Experiment HPA-RNA";
            case "Expression: JensenLab Experiment RNA-seq":
                return "JensenLab Experiment RNA-seq";
            case "Expression: JensenLab Experiment UniGene":
                return "JensenLab Experiment UniGene";
            case "Expression: JensenLab Knowledge UniProtKB-RC":
                return "JensenLab Knowledge UniProtKB-RC";
            case "Expression: JensenLab Text Mining":
                return "JensenLab Text Mining";
            case "Expression: UniProt Tissue":
                return "UniProt Tissue";
            case "WikiPathways Pathway":
                return "WikiPathways";
            case "KEGG Pathway":
                return "KEGG";
            case "Reactome Pathway":
                return "Reactome";
        }
        return type;
    }
}
