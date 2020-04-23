import {DataModelList} from "./DataModelList";

export class FacetInfo {
    type: string;
    dataTable: string;
    dataColumn: string;
    countColumn: string; // for precalculated tables
    whereClause: string;
    select: string;
    groupBy: string;
    allowedValues: string[];
    parent: DataModelList;
    tables: string[] = [];

    constructor(obj: FacetInfo) {
        this.type = obj.type || "";
        this.dataTable = obj.dataTable || "";
        this.dataColumn = obj.dataColumn || "";
        this.countColumn = obj.countColumn || "";
        this.whereClause = obj.whereClause || "";
        this.select = obj.select || this.dataString();
        this.groupBy = obj.groupBy || this.dataString();
        this.allowedValues = obj.allowedValues || [];
        this.parent = obj.parent || {};

        if(obj && obj.parent) {
            this.tables = this.parent.getRequiredTablesForFacet(this);
        }
    }

    dataString() {
        return this.dataTable + "." + this.dataColumn;
    }


    getFacetConstraintQuery(tcrd: any) {
        let query = tcrd.db(DataModelList.listToObject(this.tables))
            .select(this.parent.rootTable + ".id")
            .whereIn(tcrd.db.raw(this.select), this.allowedValues);
        if (this.whereClause.length > 0) {
            query.whereRaw(this.whereClause);
        }
        this.parent.addLinkToRootTable(query, tcrd, this);
        return query;
    }

    getFacetQuery(tcrd: any) {
        if (this.dataTable == "") {
            return null;
        }
        if (this.countColumn != "") {
            let query = tcrd.db(this.dataTable)
                .select(tcrd.db.raw(`${this.dataColumn} as name, ${this.countColumn} as value`));
            if (this.whereClause.length > 0) {
                query.whereRaw(this.whereClause);
            }
            query.orderBy('value', 'desc');

            this.parent.captureQueryPerformance(query, this.type);
            return query;
        }
        let query = tcrd.db(DataModelList.listToObject(this.tables))
            .select(tcrd.db.raw(this.select + " as name, count(distinct " + this.parent.keyString() + ") as value"));
        if (this.whereClause.length > 0) {
            query.whereRaw(this.whereClause);
        }
        this.parent.addFacetConstraints(query, tcrd, this.parent.filteringFacets, this.type);
        this.parent.addModelSpecificConstraints(query, tcrd);
        this.parent.addLinkToRootTable(query, tcrd, this);
        query.groupBy(this.groupBy).orderBy('value', 'desc');

        this.parent.captureQueryPerformance(query, this.type);
        return query;
    }

    static deduplicate(array: FacetInfo[]) {
        var newArray = array.concat();
        for (var i = 0; i < newArray.length; ++i) {
            for (var j = i + 1; j < newArray.length; ++j) {
                if (newArray[i].type === newArray[j].type)
                    newArray.splice(j--, 1);
            }
        }
        return newArray;
    }
}