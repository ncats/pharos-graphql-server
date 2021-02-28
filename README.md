Pharos graphql server
=====================

###To run

Run `npm install` to get all dependencies, then

```
npm start
```

A public instance of this DEV version of the api is available [here](https://ncatsidg-dev.appspot.com/graphql).



### To deploy on gcloud
* go to project on g cloud
* "git clone https://github.com/ncats/pharos-graphql-server"
    * "git pull" if it's already there
* cd to dir
* export PORT=8080 && npm install
* npm start          									  -- preview
* gcloud app create   								  -- first time only
* gcloud app deploy

