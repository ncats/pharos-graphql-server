export class LigandDetails {
    knex: any;

    constructor(knex: any) {
        this.knex = knex;
    }

    parseInput(input: string) {
        if (!input) {
            return {term: null, column: null};
        }
        const pieces = input.split(':');
        const column = this.getColumn(pieces[0], input);
        const term = pieces.length === 1 ? pieces[0] : pieces.slice(1).join(':');
        return {term: term, column: column};
    }

    getColumn(prefix: string, input: string) {
        if (input.toUpperCase().startsWith('CHEMBL')) {
            return 'ChEMBL';
        }
        switch (prefix.toUpperCase()) {
            case 'DC':
            case 'DRUGCENTRAL':
                return 'DrugCentral';
            case 'CID':
            case 'PUBCHEM':
                return 'PubChem';
            case 'IUPHAR':
            case 'GUIDETOPHARMACOLOGY':
            case 'G2P':
                return 'Guide to Pharmacology';
            case 'NAME':
                return 'name';
            case 'LYCHI':
            case 'LIGID':
            case 'ID':
            case 'IDENTIFIER':
                return 'identifier';
            case 'UNII':
                return 'UNII';
            case 'CHEMBL':
                return 'ChEMBL';
        }
        return null;
    }

    getDetailsQuery(name: string) {
        const input = this.parseInput(name);
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
        );
        if (!input.column) {
            query.where((q: any) => {
                q.whereRaw(`match(name, ChEMBL, PubChem, \`Guide to Pharmacology\`, DrugCentral) against('"${name}"' in boolean mode)`)
                    .andWhere((qq: any) => {
                        qq.where('name', name)
                            .orWhere('ChEMBL', name)
                            .orWhere('PubChem', name)
                            .orWhere('Guide to Pharmacology', name)
                            .orWhere('DrugCentral', name)
                    })
            })
                .orWhere('identifier', name)
                .orWhere('unii', name)
                .orWhere('pt', name)
                .orderByRaw(`identifier = "${name}" desc`);
        }
        else {
            query.where(input.column, input.term);
        }
        // console.log(query.toString());
        return query;
    }
}
