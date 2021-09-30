export class LigandDetails {
    knex: any;

    constructor(knex: any) {
        this.knex = knex;
    }

    getDetailsQuery(name: string) {
        const query = this.knex('ncats_ligands').select(
            {
                ligid: 'identifier',
                name: 'name',
                description: 'description',
                isdrug: 'isDrug',
                smiles: 'smiles',
                actcnt: 'actCnt',
                targetCount: 'targetCount',
                unii: 'unii',
                PubChem: 'PubChem',
                'Guide to Pharmacology': 'Guide to Pharmacology',
                ChEMBL: 'ChEMBL',
                DrugCentral: 'DrugCentral',
                pt: 'pt'
            }
        ).whereRaw(`match(name, ChEMBL, PubChem, \`Guide to Pharmacology\`, DrugCentral) against("${name}" in boolean mode)`)
            .orWhere('identifier', name)
            .orWhere('unii', name)
            .orWhere('pt', name);
        // console.log(query.toString());
        return query;
    }

}
