import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD
from executeSQLfile import readAndExecuteFile

def save_list(cursor, category, list):
    sql = "insert into ncats_typeahead_index values (null, %s, %s, %s)"

    formattedList = [[category, val[0], val[1] if len(val) > 1 else None] for val in list]

    chunks = 25000
    for i in xrange(0, len(formattedList), chunks):
        cursor.executemany(sql, formattedList[i:i + chunks])
    return

def load_typeahead(cursor, category, sql):
    print sql
    cursor.execute(sql)
    results = cursor.fetchall()
    save_list(cursor, category, results)
    return

def connect():
    """ Connect to MySQL database """
    conn = None
    try:
        conn = mysql.connector.connect(host=DBHOST,
                                       database=DBNAME,
                                       user=USER,
                                       password=PWORD)
        if conn.is_connected():
            print('Connected to MySQL database')
            cursor = conn.cursor()
            readAndExecuteFile(cursor, "tcrd-create-typeahead-index.sql")

            load_typeahead(cursor, "Targets", """SELECT target.name, (CASE WHEN COUNT(*) = 1 THEN max(uniprot) ELSE NULL END) AS reference_id
                                                FROM target, t2tc, protein WHERE target.name IS NOT NULL 
                                                and t2tc.target_id = target.id
                                                and t2tc.protein_id = protein.id 
                                                GROUP BY target.name""")

            load_typeahead(cursor, "Genes", "select sym, (case when count(*) = 1 then max(uniprot) else null end) AS reference_id from protein where sym is not null group by sym")
            load_typeahead(cursor, "Diseases", "select distinct ncats_name, ncats_name from disease")
            load_typeahead(cursor, "JAX/MGI Phenotype", "select distinct term_name from phenotype where ptype = 'JAX/MGI Human Ortholog Phenotype'")
            load_typeahead(cursor, "IMPC Phenotype", "select distinct term_name from phenotype where ptype = 'IMPC'")

            load_typeahead(cursor, "Interacting Virus", """select distinct virus.name FROM viral_ppi,viral_protein,virus
                                                where finalLR >= 500
                                                and viral_protein_id = viral_protein.id
                                                and virus_id = virus.virusTaxid""")

            load_typeahead(cursor, "Family", """select distinct (case fam
                                                when "IC" then "Ion Channel"
                                                when "TF; Epigenetic" then "TF-Epigenetic"
                                                when "TF" then "Transcription Factor"
                                                when "NR" then "Nuclear Receptor"
                                                else fam end) as name
                                                from target
                                                where fam is not null""")

            load_typeahead(cursor, "UniProt Keyword", "select distinct xtra from xref where xtype = 'UniProt Keyword'")
            load_typeahead(cursor, "GO Process", "select distinct substr(go_term,3) from goa where substr(go_term,1,1) = 'P'")
            load_typeahead(cursor, "GO Function", "select distinct substr(go_term,3) from goa where substr(go_term,1,1) = 'F'")
            load_typeahead(cursor, "GWAS", "select distinct disease_trait from gwas")
            load_typeahead(cursor, "WikiPathways Pathway", "select distinct name from pathway where pwtype = 'WikiPathways'")
            load_typeahead(cursor, "KEGG Pathway", "select distinct name from pathway where pwtype = 'KEGG'")
            load_typeahead(cursor, "Reactome Pathway", "select distinct name from pathway where pwtype = 'Reactome'")
            # TODO, think about doing it for all ligands?
            load_typeahead(cursor, "Drugs", "select distinct name, name from ncats_ligands where isDrug is true")


            conn.commit()

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.commit()
            conn.close()


if __name__ == '__main__':
    connect()

