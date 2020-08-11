TCRD Update Instructions :smiley_cat:
=====================

1. Download and unpack the new base TCRD database
    * http://juniper.health.unm.edu/tcrd/download/
    * Here's how we do it here
    ```
   terminal > ssh ifxdev.ncats.nih.gov
        <enter password>
   [ifxdev] $ curl -o tcrd6.6.0.sql.gz http://juniper.health.unm.edu/tcrd/download/TCRDv6.6.0.sql.gz
        (about 12 minutes)
   [ifxdev] $ gunzip tcrd6.6.0.sql.gz
        (about 2 minutes)
    ```

2. Install it on your database server
    * Here's how to do that for our AWS server for tcrd6.6.0
    ```
    [ifxdev] $ mysql -uncats -htcrd-cluster-instance-1-us-east-1a.ceyknq0yekb3.us-east-1.rds.amazonaws.com -p
                    <enter password>
    mysql > create database tcrd660;
    mysql > GRANT SELECT ON `tcrd660`.* TO 'tcrd'@'%';
    mysql > use tcrd660;
    mysql > \. tcrd6.6.0.sql
        (about 4 hours)  
    ```
3. Create a file called credentials.py in the 'pharos_database_transforms' directory.
Set these variables in that credentials file.
Here's what that looks like for our AWS server
    ```
    DBHOST = 'tcrd.ncats.io'
    DBNAME = 'tcrd660'
    USER = 'ncats'
    PWORD = '<set password, don't commit it to a repo!>'
    ```
4. Run the pharos specific transformations
    * Run these python files at the terminal, they will use credentials from credentials.py to update the database

    * First
        * create indices and columns necessary for pharos
        ```
      python executeSQLfile.py tcrd-create-indexes.sql
        ```
    * Second
        * Populate lychi_h4 keys for all ligands and drugs
            * write smiles to files
            ```
            python lychi-write-smiles.py
            ```
            * upload smiles and script to ifxdev.ncats.nih.gov
            ```
            scp *.smiles  kelleherkj@ifxdev.ncats.nih.gov:.
            scp run_all.sh  kelleherkj@ifxdev.ncats.nih.gov:.
            ```
            * run scripts on ifxdev (make sure you have the lib folder with lychi-all-fe2ea2a.jar (maybe these too? ojdbc8.jar  tripod_2.11-play_2_6-20181017-37d3106.jar) it takes a long time
            ```
            screen
            bash run_all.sh
            ctrl-a, ctrl-d
            ``` 
            * download .lychi files
            ```
            scp kelleherkj@ifxdev.ncats.nih.gov:*.lychi .
            ```
            * run script to load lychis to database
            ```
            python lychi-set.py
            ```
            
    * Later
        * create and populate the table that hold the lists of IDG targets
        ```
        python executeSQLfile.py tcrd-create-idg-lists.sql
        ```
        * create the table that is used for the typeahead functionality in the search box
        ```
        python executeSQLfile.py tcrd-create-typeahead-index.sql
        ```
        * add the ncats_name column to the disease table, which is a normalized name for disease associations which have a DOID id
        ```
        python tcrd-add-pharos-name.py
        ```

        * restructure info in drug_activity & cmpd_activity into a ligand table and an activity table
        ```
        python executeSQLfile.py tcrd-create-ncats_ligands.sql
        ```
    
        * restructure ppi info so there is a row for a PPI and columns for the different evidence sources
        ```
        python executeSQLfile.py tcrd-create-ncats_ppi.sql
        ```
        * create nested set table for querying the DO disease heirarchy
        ```
        python tcrd-create-sorted-do-tree.py
        ```
        * create mapping between generif and pubmed to speed that up
        ```
        python tcrd-create-generif-pubmed-map.py
        ```
