import {DatabaseConfig} from "./databaseConfig";
import {FieldInfo} from "./FieldInfo";
import {SqlTable} from "./sqlTable";

export interface IBuildable {
    database: any;
    databaseConfig: DatabaseConfig;

    associatedTarget: string;
    associatedDisease: string;
    rootTable: string | SqlTable;
    ppiConfidence: number;

    getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string;
    tableJoinShouldFilterList(sqlTable: SqlTable): boolean;
}
