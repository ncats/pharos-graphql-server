-- execute after lychi_h4 has been populated

DROP TABLE IF EXISTS ncats_ligand_activity;
DROP TABLE IF EXISTS ncats_ligands;

CREATE TABLE `ncats_ligands`
(
    `id`         int                                                     NOT NULL AUTO_INCREMENT,
    `identifier` varchar(255) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL COMMENT 'lychi hash if small molecule, otherwise a drug name, or other id',
    `name`       text                                                    NOT NULL COMMENT 'name of drug or ligand',
    `isDrug`     tinyint(1)   											 DEFAULT NULL COMMENT 'is this ligand a drug',
    `smiles`     text  				 									 COMMENT 'molecular structure',
    `PubChem` varchar(255) 											 	 DEFAULT NULL,
    `ChEMBL`  varchar(255) 											 	 DEFAULT NULL,
    `Guide to Pharmacology`   varchar(255) 								 DEFAULT NULL,
    `DrugCentral` varchar(255)                                           DEFAULT NULL,
    `description` text 													 COMMENT 'description of the drug from nlm_drug_info',
    `actCnt`     int          											 DEFAULT NULL COMMENT 'activity count',
    PRIMARY KEY (`id`),
    KEY `identifier` (`identifier`),
    FULLTEXT KEY `text_search` (`name`,`ChEMBL`,`PubChem`,`Guide to Pharmacology`,`DrugCentral`)
) ENGINE = InnoDB  AUTO_INCREMENT = 0  DEFAULT CHARSET = utf8;

INSERT INTO ncats_ligands
SELECT NULL,
       identifier,
       CASE
           WHEN max(drugname) IS NOT NULL THEN max(drugname)
           ELSE max(ligandname)
           END                           AS 'name',
       MAX(isDrug)                       as 'isDrug',
       CASE
           WHEN max(drugsmiles) IS NOT NULL THEN max(drugsmiles)
           ELSE max(ligandsmiles)
           END                           AS 'smiles',
       group_concat(distinct PubChem_ID) as 'PubChem',
       group_concat(distinct ChEMBL_ID)  as 'ChEMBL',
       group_concat(distinct Guide_ID)   as 'Guide to Pharmacology',
       group_concat(distinct DrugCentral) as 'DrugCentral',
       max(Description) 			     as "Description",
       COUNT(*)                          AS 'actCnt'
FROM (SELECT CASE when lychi_h4 is not null then lychi_h4 else cmpd_id_in_src end                 AS 'identifier',
             CASe when cmpd_name_in_src is not null then cmpd_name_in_src else cmpd_id_in_src end AS 'ligandname',
             NULL                                                                                 AS 'drugname',
             smiles                                                                               AS 'ligandsmiles',
             NULL                                                                                 AS 'drugsmiles',
             0                                                                                    AS 'isDrug',
             cmpd_pubchem_cid                                                                     as 'PubChem_ID',
             case when catype = 'ChEMBL' then cmpd_id_in_src else null end                        as 'ChEMBL_ID',
             case when catype = 'Guide to Pharmacology' then cmpd_id_in_src else null end         as 'Guide_ID',
             null																				  as 'DrugCentral',
             null 																				  as 'Description'
      FROM cmpd_activity
      UNION ALL
      SELECT (case when lychi_h4 is not null then lychi_h4 else drug end)	 AS 'identifier',
             NULL                                                        	 AS 'ligandname',
             drug                                                        	 AS 'drugname',
             NULL                                                        	 AS 'ligandsmiles',
             smiles                                                      	 AS 'drugsmiles',
             1                                                           	 AS 'isDrug',
             cmpd_pubchem_cid                                            	 as 'PubChem_ID',
             cmpd_chemblid                                               	 as 'ChEMBL_ID',
             null                                                        	 as 'Guide_ID',
             dcid														     as 'DrugCentral',
             nlm_drug_info												 	 as 'Description'
      FROM drug_activity) AS internal
GROUP BY identifier
ORDER BY actCnt DESC;

CREATE TABLE `ncats_ligand_activity`
(
    `id`               int NOT NULL AUTO_INCREMENT,
    `ncats_ligand_id`  int NOT NULL,
    `target_id`        int NOT NULL,
    `smiles`           text,
    `act_value`        decimal(10, 8) DEFAULT NULL,
    `act_type`         varchar(255)   DEFAULT NULL,
    `action_type`      varchar(255)   DEFAULT NULL,
    `reference`        text,
    `reference_source` varchar(255)   DEFAULT NULL,
    `pubmed_ids`       text,
    PRIMARY KEY (`id`),
    UNIQUE KEY `id_UNIQUE` (`id`),
    KEY `fk_ncats_ligand_activity_target_idx` (`target_id`),
    KEY `fk_ncats_ligand_activity_ligand_idx` (`ncats_ligand_id`),
    KEY `ligand_target_idx` (`target_id`,`ncats_ligand_id`),
    CONSTRAINT `fk_ncats_ligand_activity_ligand` FOREIGN KEY (`ncats_ligand_id`) REFERENCES `ncats_ligands` (`id`),
    CONSTRAINT `fk_ncats_ligand_activity_target` FOREIGN KEY (`target_id`) REFERENCES `target` (`id`)
) ENGINE = InnoDB
  AUTO_INCREMENT = 0
  DEFAULT CHARSET = utf8;

INSERT INTO ncats_ligand_activity
SELECT null,
       (Select id
        from ncats_ligands
        where identifier = (CASE
                                WHEN ca.lychi_h4 IS NOT NULL THEN ca.lychi_h4
                                ELSE ca.cmpd_id_in_src
            END)) AS 'ncats_ligand_id',
       target_id,
       smiles,
       act_value,
       act_type,
       NULL       AS 'action_type',
       reference,
       NULL       AS 'reference_source',
       pubmed_ids
FROM cmpd_activity ca
UNION ALL
SELECT null,
       (SELECT id
        from ncats_ligands
        where identifier = (CASE
                                WHEN da.lychi_h4 IS NOT NULL THEN da.lychi_h4
                                ELSE da.drug
            END)) AS 'ncats_ligand_id',
       target_id,
       smiles,
       act_value,
       act_type,
       action_type,
       reference,
       source     AS 'reference_source',
       NULL
FROM drug_activity da
ORDER BY ncats_ligand_id;
