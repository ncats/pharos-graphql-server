export class HierarchicalQuery {
    knex: any;

    constructor(knex: any) {
        this.knex = knex;
    }

    getHierarchyQuery(protein_id: number, tables: any,
                      columns: { id: string|any, type: string|any, value?: string|any, oid: string, ancestor_oid?:
                              string, ancestor_name?: string, ancestor_parent?: string, link_oid: string},
                      badRoots: string[] = []
    ) {
        const query = this.knex(tables)
            .select({
                id: columns.id,
                type: columns.type,
                value: columns.value || this.knex.raw('1'),
                oid: 'dataTable.' + columns.oid,
                ancestor_oid: 'ancestryTable.' + (columns.ancestor_oid ? columns.ancestor_oid : 'ancestor_id'),
                ancestor_name: 'detailTable.' + (columns.ancestor_name ? columns.ancestor_name : 'name'),
                ancestor_parent: 'parentTable.' + (columns.ancestor_parent ? columns.ancestor_parent : 'parent_id')})
            .where('dataTable.protein_id', protein_id)
            .where('dataTable.' + columns.oid, this.knex.raw('ancestryTable.oid'))
            .where('ancestryTable.ancestor_id', this.knex.raw('parentTable.' + columns.link_oid))
            .where('ancestryTable.ancestor_id', this.knex.raw('detailTable.' + columns.link_oid));
        if (badRoots.length > 0) {
            query.whereNotIn('ancestryTable.ancestor_id', badRoots);
        }
        return query;
    }

    parseHierarchyResponse(res: any[], summaryFunction: (list: number[]) => number, manualRoots?: any[],
                           normalize = false, collapseBranches = true) {
        const ontologyDict = new Map<string, any>();
        const parentDict = new Map<string, string[]>();
        let min: number;
        let max: number;
        if (manualRoots && manualRoots.length > 0) {
            manualRoots.forEach(obj => {
                this.tryAddSingleElement(ontologyDict, obj.oid, {
                    oid: obj.oid,
                    name: obj.name,
                    data: new Map<string, number>(),
                    parents: [],
                    children: []
                });
            });
        }
        res.sort((a,b) => b.value - a.value);
        res.forEach((row: any) => {
            const dictElement = this.tryAddSingleElement(ontologyDict, row.ancestor_oid, {
                oid: row.ancestor_oid,
                name: row.ancestor_name,
                data: new Map<string, number>(),
                parents: [],
                children: []
            });
            if (row.ancestor_oid === row.oid) {
                min = Math.min(min, row.value) || row.value;
                max = Math.max(max, row.value) || row.value;
                this.tryAddSingleElement(dictElement.data, row.id, row.value);
            }
            this.tryAddListElement(parentDict, row.ancestor_oid, row.ancestor_parent);
        });
        const nonRoots: string[] = [];
        ontologyDict.forEach((v, k) => {
            const parents = parentDict.get(k) || [];
            v.parents = parents;
            parents.forEach(oid => {
                const oneParent = ontologyDict.get(oid);
                if (oneParent) {
                    if (!nonRoots.includes(k)) {
                        nonRoots.push(k);
                    }
                    oneParent.children.push(v);
                }
            });
        });
        nonRoots.forEach(nonRoot => {
            ontologyDict.delete(nonRoot);
        });
        ontologyDict.forEach((v, k) => {
            if (v.data.size === 0 && v.children.length === 0) {
                ontologyDict.delete(k);
            } else {
                this.calcData(v, summaryFunction,'oid', normalize ? [min, max] : null);
            }
        });
        if (collapseBranches) {
            this.collapseDictionary(ontologyDict)
        }
        return Array.from(ontologyDict.values());
    }

    getTinxHierarchy(protein_id: number) {
        const manualRoots = [
            {oid: 'DOID:4', name: 'disease'}
        ];
        const query = this.getHierarchyQuery(protein_id,
            {dataTable: 'tinx_importance', ancestryTable: 'ancestry_do', detailTable: 'do', parentTable: 'do_parent'},
            {id: this.knex.raw("concat(dataTable.doid, '-', dataTable.protein_id)"), link_oid: 'doid',
                value: this.knex.raw('log(dataTable.score)'), type: this.knex.raw('"Tin-X"'), oid: 'doid'});
        // console.log(query.toString());
        return query.then((res: any[]) => this.parseHierarchyResponse(res,
            (list) => Math.max(...list), manualRoots, true));
    }

    getDiseaseHierarchy(protein_id: number) {
        const manualRoots = [
            {oid: 'MONDO:0000001', name: 'disease or disorder'},
            {oid: 'MONDO:0042489', name: 'disease susceptibility'}
        ];
        const query = this.getHierarchyQuery(protein_id,
            {dataTable: 'disease', ancestryTable: 'ancestry_mondo', detailTable: 'mondo', parentTable: 'mondo_parent'},
            {id: 'dataTable.id', type: 'dataTable.dtype', oid: 'mondoid', ancestor_parent: 'parentid', link_oid:'mondoid'});
        // console.log(query.toString());
        return query.then((res: any[]) => this.parseHierarchyResponse(res, (list) => list.length, manualRoots));
    }

    getExpressionHierarchy(protein_id: number) {
        const badRoots: string[] = ['GO:0005623'];
        const exprQuery = this.getHierarchyQuery(protein_id,
            {
                dataTable: 'expression',
                ancestryTable: 'ancestry_uberon',
                detailTable: 'uberon',
                parentTable: 'uberon_parent'
            },{
                id: this.knex.raw("concat('expression-',dataTable.id)"),
                value: this.knex.raw('coalesce(source_rank, number_value / 5)'),
                type: 'etype',
                oid: 'uberon_id',
                link_oid: 'uid'
            }, badRoots);

        const gtexQuery = this.getHierarchyQuery(protein_id,
            {
                dataTable: 'gtex',
                ancestryTable: 'ancestry_uberon',
                detailTable: 'uberon',
                parentTable: 'uberon_parent'
            },{
                id: this.knex.raw("concat('gtex-',dataTable.id)"),
                value: 'tpm_rank',
                type: this.knex.raw('"GTEx"'),
                oid: 'uberon_id',
                link_oid: 'uid'
            }, badRoots);

        return Promise.all([exprQuery, gtexQuery]).then((responses: any[][]) =>
            this.parseHierarchyResponse([...responses[0], ...responses[1]],
                (list) => Math.max(...list), [], true));
    }

    tryAddSingleElement(dict: Map<string, any>, key: string, value: any) {
        if (!dict.has(key)) {
            dict.set(key, value);
        }
        return dict.get(key);
    }

    tryAddListElement(dict: Map<string, any[]>, key: string, value: any) {
        let list: any[] = dict.get(key) || [];
        if (list.length === 0) {
            dict.set(key, list);
        }
        if (!list.includes(value)) {
            list.push(value);
        }
    }

    calcData(node: any, summaryFunction: (list: number[]) => number, idname = 'uid', normalizeRange: number[]|null) {
        const normalize = (val: number, min: number, max: number) => {
            if (max === min) {
                return 1;
            }
            return (val - min) / (max - min);
        };
        node.children.forEach((child: any) => {
            this.calcData(child, summaryFunction, idname, normalizeRange);
        });
        if ((node.data && node.data.size > 0) && node.children.length > 0 ) {
            const value = normalizeRange ? normalize(summaryFunction(Array.from(node.data.values())), normalizeRange[0], normalizeRange[1]) : summaryFunction(Array.from(node.data.values()));
            const directNode = {
                [idname]: node[idname],
                name: node.name + ' (direct)',
                data: new Map<string, number>(),
                parents: [],
                children: [],
                direct: 1,
                // @ts-ignore
                value: value
            };
            node.children.push(directNode);
        }
        const list: number[] = node.children.map((c: any) => c.value);
        if (node.data && node.data.size > 0) {
            // @ts-ignore
            list.push(...Array.from(node.data.values()));
        }
        const value = normalizeRange ? normalize(summaryFunction(list), normalizeRange[0], normalizeRange[1]) : summaryFunction(list);
        node.value = value;
    }

    trimNode(node: any) {
        let found = true;
        while (found) {
            found = false;

            for (let i = node.children.length - 1; i >= 0; i--) {
                const child = node.children[i];
                if (child.children.length === 0 && child.value == 0) {
                    node.children.splice(i, 1);
                    found = true;
                } else {
                    this.trimNode(child);
                    if (child.data.size === 0 && child.children.length === 1) {
                        node.children[i] = child.children[0];
                        this.trimNode(node.children[i]);
                        found = true;
                    }
                }
            }
        }
        let nondups: string[] = []
        for (let i = node.children.length - 1; i >= 0; i--) {
            const key = node.children[i].name + '-' + node.children[i].uid;
            if (nondups.includes(key)) {
                node.children.splice(i, 1);
                found = true;
            } else {
                nondups.push(key);
            }
        }
    }

    collapseDictionary(dict: Map<string, any>) {
        dict.forEach((v, k) => {
            this.trimNode(v);
        })
    }
}
