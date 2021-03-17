import {FieldInfo} from "./FieldInfo";

export class SqlTable {
    tableName: string;
    private _alias?: string;
    get alias(): string {
        if (this._alias) return this._alias;
        return this.tableName;
    }

    joinConstraint: string;
    columns: FieldInfo[] = [];
    linkingTables: string[] = [];

    constructor(tableName: string, {alias = "", joinConstraint = ""} = {},
                linkingTables: string[] = []) {
        if (alias) {
            this._alias = alias;
        }
        this.tableName = tableName;
        this.joinConstraint = joinConstraint;

        this.linkingTables = linkingTables;
        if (alias) {
            this._alias = alias;
        }
    }

    equals(tableName: string, joinConstraint: string | undefined) {
        if (!!this.joinConstraint || !!joinConstraint) {
            return this.tableName === tableName && this.joinConstraint === joinConstraint;
        }
        return this.tableName === tableName;
    }
}
