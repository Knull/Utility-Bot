// handlers/tickets/handleCloseTicketButton.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { sendEmbed, getCategoryId } = require('../../utilities/ticketUtils');
const { pool } = require('../../database'); // Assuming you have a central database module
const config = require('../../config/config');

module.exports = async function handleCloseTicketButton(interaction, client) {
    try {
        const channel = interaction.channel;
        const user = interaction.user;

        // Fetch ticket data from the database
        const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        if (ticketRows.length === 0) {
            return interaction.reply({ content: 'Ticket not found in the database.', ephemeral: true });
        }
        const ticketData = ticketRows[0];

        // Update ticket status to 'closed'
        await pool.execute('UPDATE tickets SET status = ? WHERE channel_id = ?', ['closed', channel.id]);

        // Modify channel permissions to remove user access
        await channel.permissionOverwrites.edit(ticketData.user_id, {
            ViewChannel: false,
            SendMessages: false,
        });

        // Disable "Close" and "Claim" buttons in the ticket message
        const ticketMessageId = ticketData.ticket_message_id;
        if (ticketMessageId) {
            const ticketMessage = await channel.messages.fetch(ticketMessageId);
            if (ticketMessage) {
                const updatedComponents = ticketMessage.components[0].components.map((button) => {
                    if (button.customId === 'close_ticket' || button.customId === 'claim_ticket') {
                        return ButtonBuilder.from(button).setDisabled(true);
                    }
                    return button;
                });

                const updatedRow = new ActionRowBuilder().addComponents(updatedComponents);
                await ticketMessage.edit({ components: [updatedRow] });
            }
        }

        // Send confirmation and action buttons
        const closeEmbed = new EmbedBuilder()
            .setColor(0xffff00)
            .setDescription(`Ticket closed by <@${user.id}>`);

        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('delete_ticket')
                .setLabel('Delete')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('⛔'),
            new ButtonBuilder()
                .setCustomId('reopen_ticket')
                .setLabel('Reopen')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🔓')
        );

        await channel.send({ embeds: [closeEmbed], components: [confirmRow] });

        // Move channel to archived category
        const archivedCategoryId = getCategoryId(ticketData.ticket_type, true);
        await channel.setParent(archivedCategoryId, { lockPermissions: false });

        // Reply to interaction
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Ticket successfully closed.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Ticket successfully closed.', ephemeral: true });
        }

    } catch (error) {
        console.error('Error closing the ticket:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Failed to close the ticket.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Failed to close the ticket.', ephemeral: true });
        }
    }
};
