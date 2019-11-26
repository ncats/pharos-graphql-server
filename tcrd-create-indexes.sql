--create user `tcrd`@'%';
--grant select on tcrd610.* to `tcrd`;

alter table `xref`
add fulltext index xref_text_idx(`value`, xtra)
,add index xref_idx7(xtra)
;

alter table `uberon`
add fulltext index uberon_text_idx(`name`,`def`,`comment`)
;

alter table `tinx_novelty`
add index tinx_novelty_idx2(`score`)
,add index tinx_novelty_idx3(protein_id,score desc)
;

alter table `tinx_disease`
add fulltext index tinx_disease_text_idx(`name`,`summary`)
;

alter table `tdl_info`
add fulltext index tdlinfo_text_idx(string_value)
;

alter table `target`
add index target_tdl_idx(tdl)
,add index target_fam_idx(fam)
,add fulltext index target_text_idx(`name`,`description`)
;

alter table `t2tc`
add index t2tc_idx4(target_id,protein_id)
;

alter table `pubmed`
add index pubmed_sort_idx(`date`,`id`)
,add fulltext index pubmed_text_idx(`title`,`abstract`)
;

alter table `ptscore`
add index ptscore_score_idx(score)
;

alter table `protein`
add index protein_sym_idx(`sym`)
,add fulltext index protein_text1_idx(`name`,`description`)
;

alter table `protein`
add fulltext index protein_text2_idx(`uniprot`,`sym`,`stringid`)
;

alter table `phenotype`
add index phenotype_idx4(`term_name`)
,add index phenotype_idx5(`ptype`,`nhprotein_id`)
,add index phenotype_idx6(ptype,nhprotein_id,protein_id)
,add index phenotype_nhid_idx(nhprotein_id)
,add fulltext index phenotype_text_idx(term_name,term_description)
;

alter table `pathway`
add index pathway_idx4(`name`(256))
,add fulltext index pathway_text_idx(`name`,`description`)
;

alter table `ortholog_disease`
add index ortholog_disease_idx3(did)
,add fulltext index ortholog_disease_text_idx(did,`name`)
;

alter table `ortholog`
add index ortholog_idx2(taxid, geneid)
,add index ortholog_idx3(symbol)
,add index ortholog_facet_idx(protein_id,geneid,taxid)
,add fulltext index ortholog_text_idx(symbol,`name`)
;

alter table `nhprotein`
add index nhprotein_idx2(sym)
,add index nhprotein_idx3(taxid, geneid)
,add index nhprotein_idx4(species)
,add index nhprotein_idx5(taxid,geneid)
;

alter table expression
add index expression_facet_idx(protein_id,etype,tissue(256))
,add index expression_idx4(cell_id)
,add index expression_idx5(pubmed_id)
,add index expression_idx6(oid)
,add index expression_idx7(etype,tissue(256))
,add index expression_idx8(protein_id)
,add fulltext index expression_text_idx(tissue)
;

alter table `locsig`
add index locsig_loc_idx(location)
,add index locsig_sig_idx(`signal`)
;

alter table `lincs`
add index lincs_idx2(cellid)
,add index lincs_idx3(protein_id,cellid)
;

alter table `gwas`
add index gwas_idx2(`context`(256))
,add index gwas_idx3(`p_value`)
,add index gwas_idx4(`disease_trait`)
,add index gwas_idx5(`snps`(256))
,add fulltext index gwas_text_idx(disease_trait,mapped_trait,study)
;

alter table `gwas`
add fulltext index gwas_text_idx2(snps)
;

alter table `goa`
add index goa_idx2(go_id)
,add fulltext index goa_text_idx(go_term)
;

alter table `generif`
add fulltext index generif_text_idx(text)
;

alter table `gene_attribute`
add index gene_attribute_idx3(`name`(256))
;

alter table `disease`
add index disease_idx4(`name`(256))
,add index disease_idx5(did)
,add index disease_idx6(drug_name(256))
,add fulltext index disease_text_idx(`name`,`description`,`drug_name`)
;

alter table `alias`
add fulltext index alias_text_idx(value)
;

alter table drug_activity
add lychi_h4 varchar(15)
,add index drug_lychi_idx(lychi_h4)
;

alter table cmpd_activity
add lychi_h4 varchar(15)
,add index cmpd_lychi_idx(lychi_h4)
;

create table if not exists ncats_facet_impc (
name varchar(255),
value int
);
insert ncats_facet_impc
select  d.term_name as name, count(distinct b.id) as value
from ortholog a, protein b, nhprotein c, phenotype d
where  a.geneid = c.geneid
and a.taxid = c.taxid
and c.id = d.nhprotein_id
and a.protein_id = b.id
and d.ptype = 'IMPC'
group by `d`.`term_name`
order by `value` desc
;

create table if not exists ncats_facet_expression (
etype varchar(255),
name text,
value int
);
insert ncats_facet_expression
select etype,tissue as name,count(*) as value
from expression a use index (expression_idx8), protein b
where a.protein_id = b.id
group by etype,tissue
order by value desc, etype, tissue
;

create table if not exists ncats_ligands (
id int auto_increment primary key,
lychi_h4 varchar(15) comment 'lychi hash if small molecule',
refid varchar(64) comment 'referenced identifier from external source',
name varchar(256) comment 'name of ligand',
smiles text comment 'molecular structure',
isdrug tinyint(1) comment 'is this ligand a drug',
actcnt int comment 'activity count',
index (lychi_h4),
index (refid),
index (name)
);

-- execute after lychi_h4 has been populated
insert ncats_ligands(lychi_h4,actcnt)
select lychi_h4 as lychi_h4,count(*) as actcnt
from cmpd_activity where lychi_h4 is not null group by lychi_h4
;
update ncats_ligands a, cmpd_activity b
set a.name = b.cmpd_name_in_src, a.refid = b.cmpd_id_in_src,
a.smiles = b.smiles
where a.lychi_h4 = b.lychi_h4
;
update ncats_ligands a, drug_activity b
set a.name = b.drug, a.isdrug=1,a.smiles=b.smiles
where a.lychi_h4 = b.lychi_h4
;
insert ncats_ligands(refid,actcnt)
select cmpd_id_in_src as refid,count(*) as actcnt
from cmpd_activity where lychi_h4 is null
group by cmpd_id_in_src
;
update ncats_ligands a, cmpd_activity b
set a.name = b.cmpd_name_in_src
where a.refid = b.cmpd_id_in_src
;
insert ncats_ligands(name,refid,isdrug,actcnt)
select drug as name, drug as refid, 1, count(*) as actcnt
from drug_activity where lychi_h4 is null
group by drug
;
