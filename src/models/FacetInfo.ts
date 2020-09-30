import {DataModelList} from "./DataModelList";

export enum FacetDataType {
    category,
    numeric
}

export class FacetInfo {
    type: string;
    typeModifier: string;
    dataTable: string;
    dataColumn: string;
    countColumn: string; // for precalculated tables
    whereClause: string;
    valuesDelimited: boolean;
    select: string;
    groupBy: string;
    allowedValues: string[];
    parent: DataModelList;
    tables: string[] = [];
    dataType: FacetDataType;
    binSize: number;
    log: boolean;
    sourceExplanation: string;

    constructor(obj: FacetInfo) {
        this.dataType = obj.dataType || FacetDataType.category;
        this.binSize = obj.binSize || 1;
        this.log = obj.log || false;
        this.type = obj.type || "";
        this.typeModifier = obj.typeModifier || "";
        this.dataTable = obj.dataTable || "";
        this.dataColumn = obj.dataColumn || "";
        this.countColumn = obj.countColumn || "";
        this.whereClause = obj.whereClause || "";
        this.sourceExplanation = obj.sourceExplanation || "";
        this.valuesDelimited = obj.valuesDelimited || false;
        this.select = obj.log ? (`log(${this.dataString()})`) : obj.select || this.dataString();
        this.groupBy = obj.groupBy || this.dataString();
        this.allowedValues = obj.allowedValues || [];
        this.parent = obj.parent || {};

        if (obj && obj.parent) {
            this.tables = this.parent.getRequiredTablesForFacet(this);
        }
    }

    dataString() {
        return this.dataTable + "." + this.dataColumn;
    }

    numericBounds() {
        const scrubText = function (text: string): number | null {
            if (!text) return null;
            let retVal = text.replace(/[^0-9|\-|\.]/g, '');
            if (!retVal) return null;
            return +retVal;
        };

        if (this.dataType !== FacetDataType.numeric || this.allowedValues.length < 1) {
            return null;
        }
        let pieces = this.allowedValues[0].split(',');
        return {
            min: scrubText(pieces[0]),
            max: scrubText(pieces[1]),
            includeLower: pieces[0].includes('(') ? false : true, // default is to include the lower bound, unless overriden, because that's how a histogram would work
            includeUpper: pieces[1].includes(']') ? true : false // default is to exclude the upper bound, unless overriden
        };
    }

    getFacetConstraintQuery() {
        let query = this.parent.database(DataModelList.listToObject(this.tables, this.parent.rootTable))
            .distinct(this.parent.keyString());
        if (this.dataType === FacetDataType.numeric) {
            const bounds = this.numericBounds();
            if (bounds) {
                if (bounds.min !== null) {
                    query.where(this.parent.database.raw(this.select), (bounds.includeLower ? ">=" : ">"), bounds.min);
                }
                if (bounds.max !== null) {
                    query.where(this.parent.database.raw(this.select), (bounds.includeUpper ? "<=" : "<"), bounds.max);
                }
            }
        } else {
            if (this.valuesDelimited) {
                query.where(this.parent.database.raw(`${this.select} REGEXP '${this.allowedValues.join('|')}'`));
            } else {
                query.whereIn(this.parent.database.raw(this.select), this.allowedValues);
            }
        }
        if (this.whereClause.length > 0) {
            query.whereRaw(this.whereClause);
        }
        if (this.dataTable != this.parent.rootTable) {
            this.parent.addLinkToRootTable(query, this);
        }
        return query;
    }

    getFacetQuery() {
        if (this.dataTable == "") {
            return null;
        }
        if (this.dataType === FacetDataType.numeric) {
            let query = this.parent.database(DataModelList.listToObject(this.tables, this.parent.rootTable))
                .select(this.parent.database.raw(`floor(${this.select} / ${this.binSize}) * ${this.binSize} as bin, count(distinct ${this.parent.keyString()}) as value`));
            this.parent.addFacetConstraints(query, this.parent.filteringFacets, this.type);
            this.parent.addModelSpecificFiltering(query);
            if (this.dataTable != this.parent.rootTable) {
                this.parent.addLinkToRootTable(query, this);
            }
            if (this.whereClause.length > 0) {
                query.whereRaw(this.whereClause);
            }
            if (this.log) {
                query.where(this.dataString(), ">", 0);
            } else {
                query.whereNotNull(this.dataString());
            }
            query.groupBy('bin');
            this.parent.captureQueryPerformance(query, this.type);
            return query;
        }
        if (this.countColumn != "") {
            let query = this.parent.database(this.dataTable)
                .select(this.parent.database.raw(`${this.dataColumn} as name, ${this.countColumn} as value`));
            if (this.whereClause.length > 0) {
                query.whereRaw(this.whereClause);
            }
            query.orderBy('value', 'desc');

            this.parent.captureQueryPerformance(query, this.type);
            return query;
        }
        let query = this.parent.database(DataModelList.listToObject(this.tables, this.parent.rootTable))
            .select(this.parent.database.raw(this.select + " as name, count(distinct " + this.parent.keyString() + ") as value"));
        this.parent.addFacetConstraints(query, this.parent.filteringFacets, this.type);
        if (this.whereClause.length > 0) {
            query.whereRaw(this.whereClause);
        }
        this.parent.addModelSpecificFiltering(query);
        if (this.dataTable != this.parent.rootTable) {
            this.parent.addLinkToRootTable(query, this);
        }
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
