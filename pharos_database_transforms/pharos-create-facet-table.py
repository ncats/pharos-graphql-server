import mysql.connector
from mysql.connector import Error
from credentials import *  # loads variables for DBHOST, DBNAME, USER, PWORD
import csv

def create_config_db(cursor):
    sql = """DROP DATABASE IF EXISTS pharos_config"""
    cursor.execute(sql)
    sql = """CREATE DATABASE pharos_config"""
    cursor.execute(sql)

def create_facet_table(cursor):
    sql = """CREATE TABLE `pharos_config`.`facet` (
              `id` INT NOT NULL AUTO_INCREMENT,
              `model` VARCHAR(45) NOT NULL,
              `type` VARCHAR(80) NULL,
              `description` TEXT NULL,
              PRIMARY KEY (`id`));"""
    cursor.execute(sql)

def save_config(cursor, data):
    sql = "insert into pharos_config.facet values (null, %s, %s, %s)"
    cursor.executemany(sql, data)

def import_config():
    config_data = []
    with open('facets.csv') as csvfile:
        reader = csv.reader(csvfile)
        columns = reader.next()
        for row in reader:
            config_data.append(row)
    return config_data

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
            create_config_db(cursor)
            create_facet_table(cursor)
            config = import_config()
            save_config(cursor,config)
            print('done')

    except Error as e:
        print(e)

    finally:
        if conn is not None and conn.is_connected():
            conn.commit()
            conn.close()

if __name__ == '__main__':
    connect()

