import {DatabaseConfig} from "./databaseConfig";
import * as Knex from "knex";
import {FieldInfo} from "./FieldInfo";

export interface IBuildable {
    database: Knex;
    databaseConfig: DatabaseConfig;

    associatedTarget: string;
    associatedDisease: string;
    rootTable: string;
    ppiConfidence: number;

    getSpecialModelWhereClause(fieldInfo: FieldInfo, rootTableOverride: string): string;
}
