drop table if exists `ncats_typeahead`;

create table `ncats_typeahead`(
    `value` varchar(255) not null,
    `source` varchar(25) not null,
    unique key `ncats_typeahead_val_source` (`value`,`source`),
    fulltext key `ncats_typeahead_text` (`value`)
);

insert into ncats_typeahead
SELECT
    distinct xtra as value,
             'UniProt Keyword' as source
from xref
where xtype = 'UniProt Keyword'
and xtra is not null
order by xtra;

insert into ncats_typeahead
SELECT
    distinct name as value,
             'Disease' as source
from disease
where name is not null
order by name;

insert into ncats_typeahead
select
    distinct name as value,
             'Target' as source
from target
where name is not null
order by name;

insert into ncats_typeahead
select
    distinct sym as value,
             'UniProt Gene' as source
from protein
where sym is not null
order by sym;

insert into ncats_typeahead
select
    distinct term_name as value,
             'IMPC Phenotype' as source
from phenotype
where ptype = 'IMPC'
and term_name is not null
order by term_name;