// handlers/tickets/handleModalSubmission.js
const { handleStaffReportSubmission, handlePartnershipSubmission } = require('./handleTicketCreation');

module.exports = async function handleModalSubmission(interaction, client) {
    const customId = interaction.customId;
    const [prefix, ...rest] = customId.split('_');

    if (prefix !== 'modal') {
        return; // Not a ticket-related modal
    }

    const ticketTypeKey = rest.join('_'); // e.g., 'staff_report'

    // Map modal customId to specific submission handlers
    const modalHandlers = {
        'staff_report': handleStaffReportSubmission,
        'partnership': handlePartnershipSubmission,
        // Add more mappings as needed
    };

    const handler = modalHandlers[ticketTypeKey];

    if (handler) {
        await handler(interaction, client);
    } else {
        console.warn(`No handler found for modal submission: ${customId}`);
        await interaction.reply({ content: 'Unknown modal submission.', ephemeral: true });
    }
};
