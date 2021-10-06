const axios = require('axios');

export class PythonCalculation {

    constructor() {
    }

    async calculateFisherTest(filterCounts: any[]) {
        if (!filterCounts || filterCounts.length === 0) {
            return [];
        }

        const queries = [];
        while(filterCounts.length > 0){
            const chunk = filterCounts.splice(0, 250);
            const counts = {filterCounts: chunk};
            queries.push(axios.post('https://mq2qwdmec1.execute-api.us-east-1.amazonaws.com/pharos-python37-compute', counts));
        }

        return Promise.all(queries)
            .then( (responses: any[]) => {
                const returnData: any[] = [];
                responses.forEach((response: any) => {
                    let data = response.data;
                    if(!Array.isArray(response.data)) {
                        data = response.data.replace(/-Infinity/g, "\"-Infinity\"")
                            .replace(/\[Infinity/g, "[\"Infinity\"")
                            .replace(/NaN/g, "\"NaN\"");
                        data = JSON.parse(data, (key, value) => {
                            if (value === 'NaN') {
                                return NaN;
                            }

                            if (value === 'Infinity') {
                                return Number.MAX_VALUE;
                            }

                            if (value === '-Infinity') {
                                return -Number.MAX_VALUE;
                            }

                            return value;
                        });
                    }
                   returnData.push(...data);
                });
                return returnData;
            }, ((rejected: any) => {
                console.log(rejected);
                throw new Error(rejected);
            }));
    }
}
