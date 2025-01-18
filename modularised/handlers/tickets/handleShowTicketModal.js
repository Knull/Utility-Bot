// handlers/tickets/handleShowTicketModal.js
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../../config/config');

module.exports = async function handleShowTicketModal(interaction, client) {
    const { customId } = interaction;

    const ticketTypeMap = {
        'create_staff_report': 'Staff Report',
        'create_partnership': 'Partnership',
    };

    const ticketType = ticketTypeMap[customId];

    if (!ticketType) {
        return interaction.reply({ content: 'Unknown ticket type for modal.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId(`modal_${ticketType.replace(/\s+/g, '_').toLowerCase()}`)
        .setTitle(`${ticketType} Ticket`);

    let components = [];

    if (ticketType === 'Staff Report') {
        const reportedUserField = new TextInputBuilder()
            .setCustomId('reported_user')
            .setLabel('Username/User ID of reported player')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonField = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Reason (be descriptive)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const proofField = new TextInputBuilder()
            .setCustomId('proof')
            .setLabel('Proof (attachment URLs)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        components.push(
            new ActionRowBuilder().addComponents(reportedUserField),
            new ActionRowBuilder().addComponents(reasonField),
            new ActionRowBuilder().addComponents(proofField)
        );
    } else if (ticketType === 'Partnership') {
        const inviteField = new TextInputBuilder()
            .setCustomId('invite_link')
            .setLabel('Discord Invite Link to your server')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const reasonField = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Why should we partner?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        components.push(
            new ActionRowBuilder().addComponents(inviteField),
            new ActionRowBuilder().addComponents(reasonField)
        );
    }

    modal.addComponents(...components);

    try {
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error showing modal:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'Failed to show the modal.',
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: 'Failed to show the modal.',
                ephemeral: true,
            });
        }
    }
};
