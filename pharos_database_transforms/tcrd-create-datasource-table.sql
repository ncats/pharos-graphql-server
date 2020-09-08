drop table if exists `ncats_dataSource_map`;

CREATE TABLE `ncats_dataSource_map`
(
    `id`           int         NOT NULL AUTO_INCREMENT,
    `dataSource`   VARCHAR (50) NOT NULL,
    `url` VARCHAR(128),
    `license` VARCHAR(128),
    `licenceURL` VARCHAR(128),
    `protein_id`   int,
    `ncats_ligand_id`    int,
    `disease_name` TEXT,
    PRIMARY KEY (`id`),
    KEY `dataSource_protein` (`protein_id`),
    KEY `dataSource_ligand` (`ncats_ligand_id`),
    KEY `dataSource_disease` (`disease_name`(200)),
    CONSTRAINT `dataSource_protein` FOREIGN KEY (`protein_id`) REFERENCES `protein` (`id`),
    CONSTRAINT `dataSource_ligand` FOREIGN KEY (`ncats_ligand_id`) REFERENCES `ncats_ligands` (`id`)
) DEFAULT CHARSET = utf8;
