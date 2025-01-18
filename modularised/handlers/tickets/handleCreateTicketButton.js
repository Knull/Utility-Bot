// handlers/tickets/handleCreateTicketButton.js
const { ButtonBuilder, ButtonStyle, EmbedBuilder, ActionRowBuilder } = require('discord.js');
const { getPermissionOverwrites, getCategoryId, sendEmbed, sendPlainText } = require('../../utilities/ticketUtils'); // We'll create ticketUtils.js for shared utilities
const { handleTicketCreation, handleModalSubmission } = require('./handleTicketCreation');
const config = require('../../config/config');

module.exports = async function handleCreateTicketButton(interaction, client) {
    const { customId } = interaction;
    console.log(`Create Ticket Button Interaction: ${customId}`);

    // Define ticket types based on customId
    const ticketTypeMap = {
        'create_general': 'General',
        'create_appeal': 'Appeal',
        'create_store': 'Store',
        'create_staff_report': 'Staff Report',
        'create_partnership': 'Partnership',
    };

    const ticketType = ticketTypeMap[customId];

    if (!ticketType) {
        console.warn(`Unknown ticket type for customId: ${customId}`);
        return interaction.reply({ content: 'Unknown ticket type.', ephemeral: true });
    }

    // Check if the user has the BlacklistRoleId
    if (interaction.member.roles.cache.has(config.BlacklistRoleId)) {
        console.log(`Blacklisted user ${interaction.user.tag} (${interaction.user.id}) attempted to create a ticket.`);
        const blacklistEmbed = new EmbedBuilder()
            .setColor('#ff0000') // Red color
            .setDescription(`> You are <@&${config.BlacklistRoleId}>. You cannot create tickets.`);
        return interaction.reply({ embeds: [blacklistEmbed], ephemeral: true });
    }

    // Proceed with ticket creation
    await handleTicketCreation(interaction, client, ticketType);
};
