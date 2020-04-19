import {QueryArguments} from "./query.arguments";
import {FilteringFacet} from "./query.filter.facet";
import {TargetListQuery} from "./targetListQuery";
import {Query} from "./query";

export class FacetQuery extends Query{
    facetType: FacetType;
    keyColumn: string;
    keyTable: string;
    whereClause: string;

    constructor(obj: any) {
        super();
        this.facetType = obj.facetType;
        this.keyColumn = obj.keyColumn || "";
        this.keyTable = this.keyColumn.split(".")[0];
        this.whereClause = obj.whereClause || "";
    }

    getFacetQuery(tcrd: any, args: QueryArguments): any {
        return null;
    }
}

export class PrecalculatedFacet extends FacetQuery {
    countColumn: string;

    constructor(obj: any) {
        super(obj);
        this.countColumn = obj.countColumn;
    }

    public getFacetQuery(tcrd: any, args: QueryArguments) {
        if (this.keyTable == "") {
            return null;
        }
        let query = tcrd.db(this.keyTable)
            .select(tcrd.db.raw(`${this.keyColumn} as name, ${this.countColumn} as value`));
        if (this.whereClause.length > 0) {
            query.whereRaw(this.whereClause);
        }
        query.orderBy('value', 'desc');
        this.capturePerformanceData(query);
        return query;
    }
}

export class QueryFacet extends FacetQuery {
    tables: string[];
    rawSelect: string;
    groupBy: string;
    alias: string;

    constructor(obj: any) {
        super(obj);
        this.rawSelect = obj.rawSelect || this.keyColumn || "";
        this.groupBy = obj.groupBy || obj.keyColumn || "";
        this.alias = obj.alias || "";
        this.tables = [];
        this.addRequiredTables();
    }

    private addRequiredTables() {
        this.tables.push("protein");
        this.tables.push(this.keyTable);
        switch (this.keyTable) {
            case "target":
                this.tables.push("t2tc");
                break;
            case "ncats_idg_list_type":
                this.tables.push("ncats_idg_list");
                break;
        }
        if (this.facetType == FacetType["IMPC Phenotype"]) {
            this.tables.push("nhprotein");
            this.tables.push("ortholog");
        }
    }

    public getFacetQuery(tcrd: any, args: QueryArguments) {
        if (this.keyColumn == "") return null;
        let query = tcrd.db(QueryFacet.listToObject(this.tables))
            .select(tcrd.db.raw(this.rawSelect + " as name, count(distinct protein.id) as value"));
        if (this.whereClause.length > 0) {
            query.whereRaw(this.whereClause);
        }
        TargetListQuery.addBatchConstraint(query, args.batch);
        this.addMyFacetConstraints(query, tcrd, args.filter.facets);
        TargetListQuery.addProteinListConstraint(query, args.proteinList);
        this.addProteinLink(query, tcrd);
        query.groupBy(this.groupBy).orderBy('value', 'desc');
        this.capturePerformanceData(query);
        return query;
    }

    addProteinLink(query: any, tcrd: any) {
        if (this.keyTable == 'target') {
            TargetListQuery.addTargetProteinLink(query, tcrd);
        } else if (this.keyTable == 'ncats_idg_list_type') {
            query.andWhere('protein.id', tcrd.db.raw('ncats_idg_list.protein_id'))
                .andWhere('ncats_idg_list_type.id', tcrd.db.raw('ncats_idg_list.idg_list'));
        } else if (this.facetType == FacetType["IMPC Phenotype"]) {
            query.andWhere('ortholog.geneid', tcrd.db.raw('nhprotein.geneid'))
                .andWhere('ortholog.taxid', tcrd.db.raw('nhprotein.taxid'))
                .andWhere('nhprotein.id', tcrd.db.raw('phenotype.nhprotein_id'))
                .andWhere('protein.id', tcrd.db.raw('ortholog.protein_id'));
        } else { // default is to use protein_id column from keyTable
            query.andWhere('protein.id', tcrd.db.raw(this.keyTable + '.protein_id'));
        }
    }

    addMyFacetConstraints(query: any, tcrd: any, filteringFacets: FilteringFacet[]) {
        return TargetListQuery.addFacetConstraints(query,tcrd,filteringFacets,this.facetType);
    }

    static listToObject(list: string[]) {
        let obj: any = {};
        for (let i = 0; i < list.length; i++) {
            obj[list[i]] = list[i];
        }
        return obj;
    }

    static getFacetsFromList(list: string[], nullQuery: boolean) {
        let facetList: FacetQuery[] = [];
        if (list && list.length > 0) {
            for (let i = 0; i < list.length; i++) {
                let newFacet = FacetFactory.GetFacet(list[i], nullQuery);
                if(newFacet.keyColumn != "") {
                    facetList.push(newFacet);
                }
            }
        }
        return facetList;
    }

    static AllTargetFacets() {
        return Object.keys(FacetType).filter(key => isNaN(Number(key)));
    }

    static DefaultFacets =
        [
            'Target Development Level',
            'IDG Target Lists',
            'Family',
            'IMPC Phenotype',
            'GWAS',
            'Expression: Consensus',
            'Ortholog',
            'UniProt Disease',
            'UniProt Keyword'
        ];
}


export class FacetFactory {
    constructor() {
    }

    static GetFacet(typeName: string, nullQuery: boolean): FacetQuery {
        const type: FacetType = (<any>FacetType)[typeName];
        switch (type) {
            case FacetType["Target Development Level"]:
                return new QueryFacet(
                    {
                        facetType: type,
                        keyColumn: "target.tdl",
                    });
            case FacetType.Family:
                return new QueryFacet(
                    {
                        facetType: type,
                        keyColumn: "target.fam",
                        rawSelect: `case target.fam 
                                        when 'IC' then 'Ion Channel' 
                                        when 'TF; Epigenetic' then 'TF-Epigenetic' 
                                        when 'TF' then 'Transcription Factor' 
                                        when 'NR' then 'Nuclear Receptor' 
                                        else if(target.fam is null,'Other',target.fam) end`,
                        groupBy: "name"
                    });
            case FacetType["UniProt Keyword"]:
                return new QueryFacet(
                    {
                        facetType: type,
                        keyColumn: "xref.xtra",
                        whereClause: "xref.xtype = 'UniProt Keyword'"
                    });
            case FacetType["UniProt Disease"]:
            case FacetType.Indication:
            case FacetType["Monarch Disease"]:
                return new QueryFacet(
                    {
                        facetType: type,
                        keyColumn: "disease.name",
                        whereClause: `disease.dtype = '${FacetFactory.getExtraParam(type)}'`
                    });
            case FacetType.Ortholog:
                return new QueryFacet(
                    {
                        facetType: type,
                        keyColumn: "ortholog.species"
                    });
            case FacetType["JAX/MGI Phenotype"]:
                return new QueryFacet(
                    {
                        facetType: type,
                        keyColumn: "phenotype.term_name",
                        whereClause: `phenotype.ptype = '${"JAX/MGI Human Ortholog Phenotype"}'`
                    });
            case FacetType["GO Component"]:
            case FacetType["GO Function"]:
            case FacetType["GO Process"]:
                return new QueryFacet({
                    facetType: type,
                    keyColumn: "goa.go_term",
                    rawSelect: `substr(go_term,3)`,
                    whereClause: `substr(go_term,1,1) = '${FacetFactory.getExtraParam(type)}'`
                });
            case FacetType.GWAS:
                return new QueryFacet({
                    facetType: type,
                    keyColumn: "gwas.disease_trait"
                });
            case FacetType["IDG Target Lists"]:
                return new QueryFacet({
                    facetType: type,
                    keyColumn: "ncats_idg_list_type.list_type"
                });
            case FacetType["IMPC Phenotype"]:
                if (nullQuery) {
                    return new PrecalculatedFacet({
                        facetType: type,
                        keyColumn: "ncats_facet_impc.name",
                        countColumn: "ncats_facet_impc.value"
                    });
                } else {
                    return new QueryFacet({
                        facetType: type,
                        keyColumn: "phenotype.term_name",
                        whereClause: "phenotype.ptype = 'IMPC'"
                    });
                }
            case FacetType["Expression: CCLE"]:
            case FacetType["Expression: Cell Surface Protein Atlas"]:
            case FacetType["Expression: Consensus"]:
            case FacetType["Expression: HCA RNA"]:
            case FacetType["Expression: HPA"]:
            case FacetType["Expression: HPM Gene"]:
            case FacetType["Expression: HPM Protein"]:
            case FacetType["Expression: JensenLab Experiment Cardiac proteome"]:
            case FacetType["Expression: JensenLab Experiment Exon array"]:
            case FacetType["Expression: JensenLab Experiment GNF"]:
            case FacetType["Expression: JensenLab Experiment HPA"]:
            case FacetType["Expression: JensenLab Experiment HPA-RNA"]:
            case FacetType["Expression: JensenLab Experiment RNA-seq"]:
            case FacetType["Expression: JensenLab Experiment UniGene"]:
            case FacetType["Expression: JensenLab Knowledge UniProtKB-RC"]:
            case FacetType["Expression: JensenLab Text Mining"]:
            case FacetType["Expression: UniProt Tissue"]:
                if (nullQuery) {
                    return new PrecalculatedFacet({
                        facetType: type,
                        keyColumn: "ncats_facet_expression.name",
                        countColumn: "ncats_facet_expression.value",
                        whereClause: `ncats_facet_expression.etype = '${FacetFactory.getExtraParam(type)}'`
                    });
                } else {
                    return new QueryFacet({
                        facetType: type,
                        keyColumn: "expression.tissue",
                        whereClause: `expression.etype = '${FacetFactory.getExtraParam(type)}'`
                    });
                }
        }
        return new FacetQuery({facetType: null, keyColumn: ""} as any);
    }

    static getExtraParam(type: FacetType) {
        switch (type) {
            case FacetType["UniProt Disease"]:
                return "UniProt Disease";
            case FacetType.Indication:
                return "DrugCentral Indication";
            case FacetType["Monarch Disease"]:
                return "Monarch";
            case FacetType["GO Component"]:
                return "C";
            case FacetType["GO Function"]:
                return "F";
            case FacetType["GO Process"]:
                return "P";
            case FacetType["Expression: CCLE"]:
                return "CCLE";
            case FacetType["Expression: Cell Surface Protein Atlas"]:
                return "Cell Surface Protein Atlas";
            case FacetType["Expression: Consensus"]:
                return "Consensus";
            case FacetType["Expression: HCA RNA"]:
                return "HCA RNA";
            case FacetType["Expression: HPA"]:
                return "HPA";
            case FacetType["Expression: HPM Gene"]:
                return "HPM Gene";
            case FacetType["Expression: HPM Protein"]:
                return "HPM Protein";
            case FacetType["Expression: JensenLab Experiment Cardiac proteome"]:
                return "JensenLab Experiment Cardiac proteome";
            case FacetType["Expression: JensenLab Experiment Exon array"]:
                return "JensenLab Experiment Exon array";
            case FacetType["Expression: JensenLab Experiment GNF"]:
                return "JensenLab Experiment GNF";
            case FacetType["Expression: JensenLab Experiment HPA"]:
                return "JensenLab Experiment HPA";
            case FacetType["Expression: JensenLab Experiment HPA-RNA"]:
                return "JensenLab Experiment HPA-RNA";
            case FacetType["Expression: JensenLab Experiment RNA-seq"]:
                return "JensenLab Experiment RNA-seq";
            case FacetType["Expression: JensenLab Experiment UniGene"]:
                return "JensenLab Experiment UniGene";
            case FacetType["Expression: JensenLab Knowledge UniProtKB-RC"]:
                return "JensenLab Knowledge UniProtKB-RC";
            case FacetType["Expression: JensenLab Text Mining"]:
                return "JensenLab Text Mining";
            case FacetType["Expression: UniProt Tissue"]:
                return "UniProt Tissue";
        }
        return "";
    }
}

export enum FacetType {
    "Target Development Level",
    "IDG Target Lists",
    "UniProt Keyword",
    "Family",
    "Indication",
    "Monarch Disease",
    "UniProt Disease",
    "Ortholog",
    "IMPC Phenotype",
    "JAX/MGI Phenotype",
    "GO Process",
    "GO Component",
    "GO Function",
    "GWAS",
    "Expression: CCLE",//useless
    "Expression: HCA RNA",//useless
    "Expression: HPM Protein",//useless
    "Expression: HPA",
    "Expression: JensenLab Experiment HPA",
    "Expression: HPM Gene",
    "Expression: JensenLab Experiment HPA-RNA",
    "Expression: JensenLab Experiment GNF",
    "Expression: Consensus",
    "Expression: JensenLab Experiment Exon array",
    "Expression: JensenLab Experiment RNA-seq",
    "Expression: JensenLab Experiment UniGene",
    "Expression: UniProt Tissue",
    "Expression: JensenLab Knowledge UniProtKB-RC",
    "Expression: JensenLab Text Mining",
    "Expression: JensenLab Experiment Cardiac proteome",
    "Expression: Cell Surface Protein Atlas"
}