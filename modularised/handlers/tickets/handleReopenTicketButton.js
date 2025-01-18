// handlers/tickets/handleReopenTicketButton.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getPermissionOverwrites, getCategoryId } = require('../../utilities/ticketUtils');
const { pool } = require('../../database');
const config = require('../../config/config');

module.exports = async function handleReopenTicketButton(interaction, client) {
    try {
        const { member, user, channel, message } = interaction;

        // Ensure the user has the staff role
        if (!member.roles.cache.has(config.staffRoleId)) {
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setDescription(`> Only <@&${config.staffRoleId}> can use this command.`);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        // Fetch ticket data
        const [ticketRows] = await pool.execute('SELECT * FROM tickets WHERE channel_id = ?', [channel.id]);
        if (ticketRows.length === 0) {
            return interaction.reply({ content: 'Ticket not found in the database.', ephemeral: true });
        }
        const ticketData = ticketRows[0];
        const parentCategoryId = getCategoryId(ticketData.ticket_type);

        // Update channel permissions to re-add user access
        await channel.permissionOverwrites.edit(ticketData.user_id, {
            ViewChannel: true,
            SendMessages: true,
        });

        // Move channel back to the active category
        await channel.setParent(parentCategoryId, { lockPermissions: false });

        // Update ticket status to 'open'
        await pool.execute('UPDATE tickets SET status = ? WHERE channel_id = ?', ['open', channel.id]);

        // Enable "Close" and "Claim" buttons in the ticket message
        const ticketMessageId = ticketData.ticket_message_id;
        if (ticketMessageId) {
            const ticketMessage = await channel.messages.fetch(ticketMessageId);
            if (ticketMessage) {
                const updatedComponents = ticketMessage.components[0].components.map((button) => {
                    if (button.customId === 'close_ticket' || button.customId === 'claim_ticket') {
                        return ButtonBuilder.from(button).setDisabled(false);
                    }
                    return button;
                });

                const updatedRow = new ActionRowBuilder().addComponents(updatedComponents);
                await ticketMessage.edit({ components: [updatedRow] });
            }
        }

        // Disable "Delete" and "Reopen" buttons in the current interaction's message
        if (interaction.message && interaction.message.components.length > 0) {
            const updatedComponents = interaction.message.components[0].components.map((button) => {
                if (button.customId === 'delete_ticket' || button.customId === 'reopen_ticket') {
                    return ButtonBuilder.from(button).setDisabled(true);
                }
                return button;
            });

            const updatedRow = new ActionRowBuilder().addComponents(updatedComponents);
            await interaction.update({ components: [updatedRow] });
        }

        // Send a confirmation message in the channel
        const reopenEmbed = new EmbedBuilder()
            .setColor(0x39ff14) // Green
            .setDescription(`Ticket reopened by <@${user.id}>`);

        await channel.send({ embeds: [reopenEmbed] });

    } catch (error) {
        console.error('Error reopening the ticket:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Failed to reopen the ticket.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Failed to reopen the ticket.', ephemeral: true });
        }
    }
};
