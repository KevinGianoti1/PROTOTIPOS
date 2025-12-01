const logger = require('../../utils/logger');

class MockRDStationService {
    constructor() {
        this.leads = [];
        this.deals = [];
    }

    async processLead(leadData) {
        logger.info('🧪 [MOCK RD] Processing Lead:', leadData.lead.nome);
        this.leads.push(leadData);
        return { success: true, id: 'mock_lead_id_123' };
    }

    async createDeal(leadData) {
        logger.info('🧪 [MOCK RD] Creating Deal for:', leadData.lead.nome);
        this.deals.push(leadData);
        return { success: true, id: 'mock_deal_id_456' };
    }
}

module.exports = MockRDStationService;
