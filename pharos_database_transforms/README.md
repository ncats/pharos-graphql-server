TCRD Update Instructions :smiley_cat:
=====================

1. Download the new base TCRD database
    * http://juniper.health.unm.edu/tcrd/download/

2. Unzip it somewhere
3. Install it on your database server
    * Here's how to do that for our AWS server for tcrd6.6.0 (it takes a while)
    ```
    terminal > mysql -uncats -htcrd-cluster-instance-1-us-east-1a.ceyknq0yekb3.us-east-1.rds.amazonaws.com -p
                    <prompt for password>
    mysql > create database tcrd660;
    mysql > GRANT SELECT ON `tcrd660`.* TO 'tcrd'@'%';
    mysql > use tcrd660;
    mysql > \. ../tcrd6.6.0.sql   # this takes forever (16 hours ish)   
    ```
4. Create a file called credentials.py in the 'pharos_database_transforms' directory.
Set these variables in that credentials file.
Here's what that looks like for our AWS server
    ```
    DBHOST = 'tcrd.ncats.io'
    DBNAME = 'tcrd610'
    USER = 'ncats'
    PWORD = '<set to the actual password, don't commit it to a repo!>'
    ```
5. Run the pharos specific transformations
    * Run these python files at the terminal, they will use credentials from credentials.py to update the database

    * First
        * create indices and columns necessary for pharos
        ```
      python executeSQLfile.py tcrd-create-indexes.sql
        ```
    * Second
        * Populate lychi_h4 keys for all ligands and drugs
        ```
        TODO: get lychis when Trung tells me how, and then save them, check them against old version
        ```

    * Later (whatever order)
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
        tcrd-create-sorted-do-tree.py
        ```
