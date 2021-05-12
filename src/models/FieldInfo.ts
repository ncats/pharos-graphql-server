import {DataModelList} from "./DataModelList";
import {QueryDefinition} from "./queryDefinition";
import {SqlTable} from "./sqlTable";

export enum FacetDataType {
    category = 'category',
    numeric = 'numeric'
}

export class FieldInfo {
    name: string;
    description: string;

    schema: string;
    table: string;
    column: string;
    alias: string;
    select: string;
    where_clause: string;
    group_method: string;

    null_table: string;
    null_column: string;
    null_count_column: string;
    null_where_clause: string;

    dataType: FacetDataType;
    binSize: number;
    log: boolean;

    order: number;
    default: boolean;

    needsDistinct: boolean;
    typeModifier: string;
    valuesDelimited: boolean;
    allowedValues: string[];
    parent: DataModelList;

    isFromListQuery: boolean;

    constructor(obj: any) {
        this.name = obj?.name || '';
        this.schema = obj?.schema || '';
        this.description = obj?.description || '';

        this.table = obj?.table || '';
        this.column = obj?.column || '';
        if(obj?.column){
            if(obj.column.includes(' ')){
                this.column = '`' + obj.column + '`';
            }
            else{
                this.column = obj.column;
            }
        }
        this.alias = obj?.alias || this.column;
        this.where_clause = obj?.where_clause || '';
        this.group_method = obj?.group_method || '';

        this.null_table = obj?.null_table || '';
        this.null_column = obj?.null_column || '';
        this.null_count_column = obj?.null_count_column || '';
        this.null_where_clause = obj?.null_where_clause || '';

        this.dataType = obj?.dataType || FacetDataType.category;
        this.binSize = obj?.binSize || 1;
        this.log = obj?.log || false;

        this.order = obj?.order;
        this.default = obj?.default || false;

        this.needsDistinct = obj?.needsDistinct || false;
        this.typeModifier = obj?.typeModifier || "";
        this.valuesDelimited = obj?.valuesDelimited || false;
        this.allowedValues = obj?.allowedValues || [];
        this.parent = obj?.parent || {};

        this.isFromListQuery = obj?.isFromListQuery || false;

        this.select = obj?.log ? (`log(${this.dataString()})`) : obj?.select || this.dataString();
    }

    dataString() {
        return this.table + '.' + this.column;
    }

    copy() {
        return new FieldInfo(this);
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
        const queryDefinition = QueryDefinition.GenerateQueryDefinition(
            {
                database: this.parent.database,
                databaseConfig: this.parent.databaseConfig,
                associatedTarget: this.parent.associatedTarget,
                associatedDisease: this.parent.associatedDisease,
                rootTable: new SqlTable(this.table, {schema: this.schema}),
                ppiConfidence: this.parent.ppiConfidence,
                getSpecialModelWhereClause: this.parent.getSpecialModelWhereClause.bind(this.parent),
                tableNeedsInnerJoin: this.parent.tableNeedsInnerJoin.bind(this.parent)
            }, [
                new FieldInfo({
                    table: this.parent.rootTable,
                    column: this.parent.keyColumn,
                    needsDistinct: true
                } as FieldInfo)
            ]);
        const query = queryDefinition.generateBaseQuery(true);

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
                query.where(this.parent.database.raw(`${this.select} REGEXP "${this.allowedValues.join('|')}"`));
            } else {
                query.whereIn(this.parent.database.raw(this.select), this.allowedValues);
            }
        }
        if (this.where_clause.length > 0) {
            query.whereRaw(this.where_clause);
        }
        query.whereNotNull(`${this.parent.rootTable}.${this.parent.keyColumn}`);
        // console.log(query.toString());
        return query;
    }

    getFacetQuery() {
        if (this.table == "") {
            return null;
        }
        let query;
        if (this.parent.isNull() && this.null_count_column) {
            query = this.getPrecalculatedFacetQuery();
        } else if (this.dataType === FacetDataType.numeric) {
            query = this.getNumericFacetQuery();
        } else {
            query = this.getStandardFacetQuery();
        }
        this.parent.captureQueryPerformance(query, this.name);
        // console.log(query.toString());
        return query;
    }

    private getPrecalculatedFacetQuery() {
        let query = this.parent.database(this.null_table).select({
            name: this.null_column,
            value: this.null_count_column
        });
        if (this.null_where_clause.length > 0) {
            query.whereRaw(this.null_where_clause);
        }
        query.orderBy('value', 'desc');
        return query;
    }

    private getStandardFacetQuery() {
        let queryDefinition = QueryDefinition.GenerateQueryDefinition(this.parent,
            [
                {...this, alias: 'name'},
                (this.getCountColumnInfo())
            ]);

        let query = queryDefinition.generateBaseQuery(true);

        this.parent.addFacetConstraints(query, this.parent.filteringFacets, this.name);
        this.parent.addModelSpecificFiltering(query, false, [this.table]);
        query.groupBy(1).orderBy('value', 'desc');
        return query;
    }

    private getNumericFacetQuery() {
        let queryDefinition = QueryDefinition.GenerateQueryDefinition(this.parent,
            [
                {
                    ...this,
                    select: `floor(${this.select} / ${this.binSize}) * ${this.binSize}`,
                    alias: 'bin'
                },
                (this.getCountColumnInfo())
            ]);
        let query = queryDefinition.generateBaseQuery(true);
        this.parent.addFacetConstraints(query, this.parent.filteringFacets, this.name);
        this.parent.addModelSpecificFiltering(query, false, [this.table]);
        if (this.log) {
            query.where(this.dataString(), ">", 0);
        } else {
            query.whereNotNull(this.dataString());
        }
        query.groupBy('bin');
        // console.log(query.toString());
        return query;
    }

    private getCountColumnInfo() {
        return new FieldInfo({
            table: this.parent.rootTable,
            column: this.parent.keyColumn,
            group_method: 'count',
            alias: 'value'
        } as FieldInfo);
    }

    static deduplicate(array: FieldInfo[]) {
        var newArray = array.concat();
        for (var i = 0; i < newArray.length; ++i) {
            for (var j = i + 1; j < newArray.length; ++j) {
                if (newArray[i].name === newArray[j].name)
                    newArray.splice(j--, 1);
            }
        }
        return newArray;
    }
}
