import {DatabaseConfig} from "./databaseConfig";
import * as Knex from "knex";
import {FieldInfo} from "./FieldInfo";
import {SqlTable} from "./sqlTable";

export interface IBuildable {
    database: Knex;
    databaseConfig: DatabaseConfig;

    associatedTarget: string;
    associatedDisease: string;
    rootTable: string | SqlTable;
    ppiConfidence: number;

    getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string;
    tableNeedsInnerJoin(sqlTable: SqlTable): boolean;
}
