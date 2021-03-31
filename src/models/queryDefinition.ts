import {FieldInfo} from "./FieldInfo";
import {DatabaseTable} from "./databaseTable";
import {SqlTable} from "./sqlTable";
import {IBuildable} from "./IBuildable";

/**
 * Class to hold all the details required to generate a query given a required set of data
 */
export class QueryDefinition {
    buildable: IBuildable;
    dataList: FieldInfo[];
    static GenerateQueryDefinition(buildabelObj: IBuildable, dataList: FieldInfo[]): QueryDefinition {
        let qd = new QueryDefinition(buildabelObj, dataList);
        for (let i = 0; i < dataList.length; i++) {
            qd.addRequestedData(dataList[i]);
        }
        return qd;
    }

    tables: SqlTable[] = [];

    private constructor(buildableObj: IBuildable, dataList: FieldInfo[]) {
        this.dataList = dataList;
        this.buildable = buildableObj;
    }

    addRequestedData(reqData: FieldInfo) {
        const specialWhereClause = this.buildable.getSpecialModelWhereClause(reqData, this.buildable.rootTable);
        if(specialWhereClause){
            if(reqData.where_clause){
                reqData.where_clause = reqData.where_clause + ' and ' + specialWhereClause;
            }
            else {
                reqData.where_clause = specialWhereClause;
            }
        }
        const existingTable = this.tables.find(table => {
            return table.equals(reqData.table, reqData.where_clause);
        });
        if (existingTable) {
            this.updateTableAliasForColumn(reqData, existingTable.alias);
            existingTable.columns.push(reqData);
            return;
        }
        this.addRequestedDataToNewTable(reqData);
    }

    updateTableAliasForColumn(reqData: FieldInfo, tableAlias: string){
        const re = new RegExp('\\b' + reqData.table + '\\b', 'ig');
        reqData.where_clause = reqData.where_clause?.replace(re, tableAlias);
        reqData.select = reqData.select?.replace(re, tableAlias);
    }

    addRequestedDataToNewTable(reqData: FieldInfo) {
        let links: string[] = [];
        const tableCount = this.tables.filter(t => {
            return t.tableName == reqData.table;
        }).length;

        let tableAlias = reqData.table;
        let original_where_clause = reqData.where_clause;
        if(tableCount > 0){
            tableAlias = reqData.table + tableCount;
            this.updateTableAliasForColumn(reqData, tableAlias);
        }

        if (reqData.table != this.buildable.rootTable) {
            links = DatabaseTable.getRequiredLinks(reqData.table, this.buildable.rootTable) || [];
        }


        const newTable = new SqlTable(reqData.table, {
            alias: tableAlias,
            joinConstraint: reqData.where_clause,
            rawJoinConstraint: original_where_clause
        }, links);
        newTable.columns.push(reqData);
        this.tables.push(newTable);
    }


    getJoinTables(): SqlTable[] {
        return this.tables.filter(table => !this.isRootTable(table));
    }


    hasGroupedColumns(): boolean {
        let found = false;
        this.tables.forEach(table => {
            table.columns.forEach(column => {
                if (column.group_method) {
                    found = true;
                }
            });
        });
        return found;
    }


    getSqlTable(field: FieldInfo): SqlTable {
        let sortTable: SqlTable;
        this.tables.forEach(t => {
            if(!sortTable) {
                t.columns.forEach(c => {
                    if(c.name === field.name && c.table === field.table && c.column === field.column) {
                        sortTable = t;
                    }
                });
            }
        });
        // @ts-ignore
        return sortTable;
    }

    getColumnList(db: any) {
        const columnList: any = {};
        this.tables.forEach(table => {
            table.columns.forEach(column => {
                const select = column.select || `${table.alias}.${column.column}`;
                const columnName = column.alias || column.column;
                if (column.group_method) {
                    columnList[columnName] = db.raw(column.group_method + `(distinct ${select})`);
                } else if (column.needsDistinct) {
                    columnList[columnName] = db.raw(`distinct ${select}`);
                } else {
                    columnList[columnName] = db.raw(select);
                }
            })
        });
        return columnList;
    }

    getRootTable(): SqlTable {
        const rootTable = this.tables.find(table => {
            return this.isRootTable(table);
        });
        if (rootTable) {
            return rootTable;
        }
        return new SqlTable(this.buildable.rootTable);
    }

    isRootTable(dataTable: SqlTable): boolean {
        return dataTable.tableName === this.buildable.rootTable && dataTable.alias === this.buildable.rootTable;
    }

    generateBaseQuery(forFacet: boolean){
        const buildableObj = this.buildable;
        let rootTableObject = this.getRootTable();
        if (rootTableObject == undefined) {
            throw new Error('failed to build SQL query');
        }
        let joinTables = this.getJoinTables();
        let query = buildableObj.database(rootTableObject.tableName)
            .select(this.getColumnList(buildableObj.database));


        const tablesInQuery: string[] = [];
        joinTables.forEach(dataTable => {
            if(dataTable.columns[0].isFromListQuery) {
                return;
            }
            let joinFunction = 'leftJoin';
            if(forFacet || this.buildable.tableNeedsInnerJoin(dataTable)){
                joinFunction = 'join';
            }
            let leftTable = rootTableObject;
            dataTable.linkingTables.forEach(linkTableName => {
                if(!tablesInQuery.includes(linkTableName)) {
                    let linkInfo = buildableObj.databaseConfig.getLinkInformation(leftTable.tableName, linkTableName);
                    // @ts-ignore
                    query[joinFunction](linkTableName, function (this: any) {
                        this.on(`${leftTable.alias}.${linkInfo.fromCol}`, `=`, `${linkTableName}.${linkInfo.toCol}`);
                    });
                    tablesInQuery.push(linkTableName);
                }
                leftTable = new SqlTable(linkTableName);
            });

            if(!tablesInQuery.includes(dataTable.alias)) {
                let linkInfo = buildableObj.databaseConfig.getLinkInformation(leftTable.tableName, dataTable.tableName);
                // @ts-ignore
                query[joinFunction]({[dataTable.alias]: dataTable.tableName}, function (this: any) {
                    if(leftTable.tableName !== dataTable.tableName || !dataTable.joinConstraint) {
                        this.on(`${leftTable.alias}.${linkInfo.fromCol}`, `=`, `${dataTable.alias}.${linkInfo.toCol}`);
                    }
                    if (dataTable.joinConstraint) {
                        this.andOn(buildableObj.database.raw(dataTable.joinConstraint));
                    }
                });
                tablesInQuery.push(dataTable.alias);
            }
        });
        return query;
    }
}
