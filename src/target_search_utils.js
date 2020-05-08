const utils = {
    parseFilterOrder: function (filter) {
        let order = filter.order;
        let sortColumn = order;
        let dir = 'desc';

        if (order) {
            let ch = order.charAt(0);
            if (ch == '^' || ch == '!') {
                order = order.substring(1);
                sortColumn = order;
                if (ch == '^') dir = 'asc';
            }

            switch (order) {
                case 'Ab Count':
                case 'MAb Count':
                case 'NCBI Gene PubMed Count':
                case 'EBI Total Patent Count':
                case 'ChEMBL First Reference Year':
                    sortColumn = 'integer_value';
                    break;

                case 'JensenLab PubMed Score':
                case 'PubTator Score':
                    sortColumn = 'number_value';
                    break;
            }
        }
        return {
            'order': order,
            'sortColumn': sortColumn,
            'dir': dir
        };
    }
};

module.exports = utils;