alter table `target`
add index target_tdl_idx(tdl)
add index target_fam_idx(fam)
;

alter table `alias`
add fulltext index alias_text_idx(value)
;

alter table phenotype
add index phenotype_nhid_idx(nhprotein_id)
;

alter table expression
add index expression_facet_idx(protein_id,etype,tissue(255))
;


create table ncats_facet_impc as
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

create table ncats_facet_expression as
select etype,tissue as name,count(*) as value
from expression a use index (expression_pid_idx), protein b
where a.protein_id = b.id
group by etype,tissue
order by value desc, etype, tissue
;
