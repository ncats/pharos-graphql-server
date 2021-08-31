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
    requirement: string;
    table: string;
    column: string;
    alias: string;
    select: string;
    where_clause: string;
    group_method: string;

    dataType: FacetDataType;
    binSize: number;
    single_response: boolean;
    log: boolean;

    order: number;
    default: boolean;

    needsDistinct: boolean;
    typeModifier: string;
    valuesDelimited: boolean;
    allowedValues: string[];
    upsetValues: { inGroup: string[], outGroup: string[] }[];
    parent: DataModelList;

    isFromListQuery: boolean;
    isForUpsetPlot: boolean;

    constructor(obj: any) {
        this.name = obj?.name || '';
        this.schema = obj?.schema || '';
        this.requirement = obj?.requirement || '';
        this.description = obj?.description || '';

        this.table = obj?.table || '';
        this.column = obj?.column || '';
        if (obj?.column) {
            if (obj.column.includes(' ')) {
                this.column = '`' + obj.column + '`';
            } else {
                this.column = obj.column;
            }
        }
        this.alias = obj?.alias || this.column;
        this.where_clause = obj?.where_clause || '';
        this.group_method = obj?.group_method || '';
        this.single_response = obj?.single_response || false;

        this.dataType = obj?.dataType || FacetDataType.category;
        this.binSize = obj?.binSize || 1;
        this.log = obj?.log || false;

        this.order = obj?.order;
        this.default = obj?.default || false;

        this.needsDistinct = obj?.needsDistinct || false;
        this.typeModifier = obj?.typeModifier || "";
        this.valuesDelimited = obj?.valuesDelimited || false;
        this.allowedValues = obj?.allowedValues || [];
        this.upsetValues = obj?.upSet || [];
        this.parent = obj?.parent || {};

        this.isFromListQuery = obj?.isFromListQuery || false;
        this.isForUpsetPlot = obj?.isForUpsetPlot || false;

        this.select = obj?.log ? (`log(${this.dataString()})`) : obj?.select || this.dataString();
        this.handleWeirdCases();
    }

    // TODO, make this not necessary :(
    handleWeirdCases() {
        if (this.table === 'ncats_ppi' && this.column === 'ppitypes') {
            this.valuesDelimited = true;
        }
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
                tableJoinShouldFilterList: this.parent.tableJoinShouldFilterList.bind(this.parent)
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

    getUpsetConstraintQuery() {
        const queries: any[] = [];
        this.upsetValues.forEach(upSet => {
            const upsetList = this.getUpsetFacetQuery(upSet);
            queries.push(this.parent.database(upsetList.as('subq')).select('id')
                .where('values', upSet.inGroup.sort((a, b) => {
                    return a.toLowerCase().localeCompare(b.toLowerCase());
                }).join('|')));
        });
        return queries;
    }

    getUpsetFacetQuery(upSet: { inGroup: string[], outGroup: string[] }) {
        const queryDefinition = QueryDefinition.GenerateQueryDefinition(
            {
                database: this.parent.database,
                databaseConfig: this.parent.databaseConfig,
                associatedTarget: this.parent.associatedTarget,
                associatedDisease: this.parent.associatedDisease,
                rootTable: new SqlTable(this.table, {schema: this.schema}),
                ppiConfidence: this.parent.ppiConfidence,
                getSpecialModelWhereClause: this.parent.getSpecialModelWhereClause.bind(this.parent),
                tableJoinShouldFilterList: this.parent.tableJoinShouldFilterList.bind(this.parent)
            }, [
                new FieldInfo({
                    table: this.parent.rootTable,
                    column: this.parent.keyColumn,
                    alias: 'id'
                } as FieldInfo),
                new FieldInfo({
                    ...this,
                    group_method: 'group_concat',
                    isForUpsetPlot: true,
                    alias: 'values'
                })
            ]);
        const query = queryDefinition.generateBaseQuery(true);
        query.whereIn(this.table + '.' + this.column, [...upSet.inGroup, ...upSet.outGroup]);
        query.groupBy(this.parent.keyString());
        if (this.where_clause.length > 0) {
            query.whereRaw(this.where_clause);
        }
        return query;
    }

    getFacetQuery() {
        if (this.table == "") {
            return null;
        }
        let query;
        if (this.dataType === FacetDataType.numeric) {
            query = this.getNumericFacetQuery();
        } else if (this.parent.isNull() && !this.parent.noOptimization) {
            query = this.getPrecalculatedFacetQuery();
        } else {
            query = this.getStandardFacetQuery();
        }
        this.parent.captureQueryPerformance(query, this.name);
        // console.log(query.toString());
        return query;
    }

    private getPrecalculatedFacetQuery() {
        let query = this.parent.database('ncats_unfiltered_counts').select({
            name: 'value',
            value: 'count'
        }).where('schema', this.parent.databaseConfig.configDB)
            .andWhere('model', this.parent.modelInfo.name)
            .andWhere('filter', this.name)
            .orderBy('value', 'desc');
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
        this.parent.addModelSpecificFiltering(query, false);
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
        this.parent.addModelSpecificFiltering(query, false);
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
