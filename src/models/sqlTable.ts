import {FieldInfo} from "./FieldInfo";

export class SqlTable {
    schema: string;
    tableName: string;
    private _alias?: string;
    get alias(): string {
        if (this._alias) return this._alias;
        return this.tableName;
    }

    joinConstraint: string;
    rawJoinConstraint: string;
    columns: FieldInfo[] = [];
    linkingTables: string[] = [];

    constructor(tableName: string,
                {alias = "", joinConstraint = "", rawJoinConstraint = "", schema = ""} = {},
                linkingTables: string[] = []) {

        if (alias) {
            this._alias = alias;
        }
        this.schema = schema;
        this.tableName = tableName;
        this.joinConstraint = joinConstraint;
        this.rawJoinConstraint = rawJoinConstraint;
        this.linkingTables = linkingTables;
    }

    equals(tableName: string, joinConstraint: string | undefined) {
        if (this.rawJoinConstraint.length > 0 || !!joinConstraint) {
            return this.tableName === tableName && this.rawJoinConstraint === joinConstraint;
        }
        return this.tableName === tableName;
    }
}
