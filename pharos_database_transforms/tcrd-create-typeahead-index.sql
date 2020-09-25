drop table if exists `ncats_typeahead_index`;

CREATE TABLE `ncats_typeahead_index`
(
    `id`       INT          NOT NULL AUTO_INCREMENT,
    `category` VARCHAR(45)  NOT NULL,
    `value`    VARCHAR(255) NOT NULL,
    `reference_id` VARCHAR(255),
    PRIMARY KEY (`id`),
    fulltext key `ncats_typeahead_text` (`value`)
);
