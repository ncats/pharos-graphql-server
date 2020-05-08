DROP TABLE IF EXISTS ncats_ppi;
CREATE TABLE `ncats_ppi` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ppitypes` varchar(255) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `protein_id` int NOT NULL,
  `other_id` int NOT NULL,
  `p_int` decimal(10,9) DEFAULT NULL,
  `p_ni` decimal(10,9) DEFAULT NULL,
  `p_wrong` decimal(10,9) DEFAULT NULL,
  `evidence` varchar(255) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `interaction_type` varchar(100) CHARACTER SET utf8 COLLATE utf8_unicode_ci DEFAULT NULL,
  `score` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `ncats_ppi_idx1` (`protein_id`),
  KEY `ncats_ppi_idx2` (`other_id`),
  CONSTRAINT `fk_ppi_protein` FOREIGN KEY (`protein_id`) REFERENCES `protein` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ppi_other` FOREIGN KEY (`other_id`) REFERENCES `protein` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

insert into ncats_ppi
select
	NULL,
	group_concat(distinct ppitype order by ppitype) as ppitypes,
    protein_id,
    other_id,
    avg(p_int) as p_int,
    avg(p_ni) as p_ni,
    avg(p_wrong) as p_wrong,
    group_concat(evidence) as evidence,
    group_concat(interaction_type) as interaction_type,
    avg(score) as score
FROM
(select
	ppitype,
	protein1_id as protein_id,
    protein2_id as other_id,
    p_int,
    p_ni,
    p_wrong,
    evidence,
    interaction_type,
    score
FROM
	ppi
WHERE
	ppitype != 'STRINGDB'
union select
	ppitype,
	protein2_id as protein_id,
    protein1_id as other_id,
    p_int,
    p_ni,
    p_wrong,
    evidence,
    interaction_type,
    score
FROM
	ppi
WHERE
	ppitype != 'STRINGDB'
union select
	ppitype,
	protein1_id as protein_id,
    protein2_id as other_id,
    p_int,
    p_ni,
    p_wrong,
    evidence,
    interaction_type,
    score
FROM
	ppi
WHERE
	ppitype = 'STRINGDB') as temp
GROUP BY protein_id, other_id;