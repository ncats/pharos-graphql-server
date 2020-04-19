import now from "performance-now";

export class Query{
    startTime: number;
    endTime: number;

    constructor() {
        this.startTime = -1;
        this.endTime = -1;
    }

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