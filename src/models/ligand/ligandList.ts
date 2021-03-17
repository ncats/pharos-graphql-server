import {DataModelList} from "../DataModelList";
import {FieldInfo} from "../FieldInfo";
import {LigandFacetFactory} from "./ligandFacetFactory";
import {ConfigKeys} from "../config";

export class LigandList extends DataModelList{

    static getAutocomplete(knex: any, term: string){
        let query = knex("ncats_ligands")
            .select({value: knex.raw('distinct name'), source: knex.raw("'Ligand'")})
            .where('name', 'not like', 'chembl%')
            .andWhere('name', 'like', '%' + term + '%')
            .orderByRaw(`CASE WHEN name LIKE '${term}%' THEN 1
                              WHEN name LIKE '% ${term}%' THEN 2
                              ELSE 3 END, name`)
            .limit(10);
        return query;
    }

    constructor(tcrd: any, json: any) {
        super(tcrd, "ncats_ligands" , "id", new LigandFacetFactory(), json);
        let facetList: string[];
        if (this.associatedTarget) {
            facetList = this.DefaultFacetsWithTarget;
        } else {
            facetList = this.DefaultFacets;
        }
        this.facetsToFetch = FieldInfo.deduplicate(
            this.facetsToFetch.concat(this.facetFactory.getFacetsFromList(this, facetList)));
    }

    get DefaultFacetsWithTarget() {
        return this.databaseConfig.getDefaultFields('Ligand', 'facet', 'Target')
            .map(a => a.name) || [];
    };

    defaultSortParameters(): {column: string; order: string}[]
    {
        return [{column: 'actcnt', order: 'desc'}];
    };

    getDefaultFields(): FieldInfo[] {
        return [];
        // return ConfigKeys.Ligand_List_Default
        };

    addModelSpecificFiltering(query: any): void {
        if(this.associatedTarget){
            let associatedTargetQuery = this.database({ncats_ligands: "ncats_ligands", ncats_ligand_activity: "ncats_ligand_activity", t2tc: "t2tc", protein: "protein"})
                .distinct("ncats_ligands.identifier")
                .whereRaw(this.database.raw(`match(uniprot,sym,stringid) against('${this.associatedTarget}' in boolean mode)`))
                .andWhere(this.database.raw(`ncats_ligands.id = ncats_ligand_activity.ncats_ligand_id`))
                .andWhere(this.database.raw(`ncats_ligand_activity.target_id = t2tc.target_id`))
                .andWhere(this.database.raw(`t2tc.protein_id = protein.id`)).as('assocTarget');
            query.join(associatedTargetQuery, 'assocTarget.identifier', 'ncats_ligands.identifier');
        }
        else if (this.term.length > 0){
            query.whereRaw(`match(name, ChEMBL, PubChem, \`Guide to Pharmacology\`, DrugCentral) against('${this.term}*')`);
        }
    }

    getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string {
        return '';
    }
}

