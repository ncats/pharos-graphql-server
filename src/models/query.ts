const now = require( "performance-now");

export class Query{
    startTime?: number;
    endTime?: number;

    getElapsedTime(){
        if(this.startTime && this.endTime){
            return (this.endTime - this.startTime) / 1000;
        }
    }

    capturePerformanceData(query: any){
        query.on('query', (data: any) => {this.startTime = now()})
            .on('query-response', (data: any) => {this.endTime = now()});
    }
}