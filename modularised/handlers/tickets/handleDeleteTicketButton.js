// handlers/tickets/handleDeleteTicketButton.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { exportChatLogs } = require('../../utilities/chatLogger');
const { pool } = require('../../database');
const config = require('../../config/config');
const fs = require('fs');

module.exports = async function handleDeleteTicketButton(interaction, client) {
    try {
        const { guild, channel, user } = interaction;

        // Ensure the user has the staff role
        if (!interaction.member.roles.cache.has(config.staffRoleId)) {
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

        // Update ticket status to 'deleted'
        await pool.execute('UPDATE tickets SET status = ? WHERE channel_id = ?', ['deleted', channel.id]);

        // Defer the reply
        await interaction.deferReply({ ephemeral: true });

        const ticketCounter = ticketData.ticket_number;
        const ticketCreatorId = ticketData.user_id;
        const ticketCreator = await guild.members.fetch(ticketCreatorId).catch(() => null);
        const ticketCreatorUsername = ticketCreator ? ticketCreator.user.username : 'Unknown User';

        const ticketType = ticketData.ticket_type || 'General';
        const ticketTypeCapitalized = ticketType.charAt(0).toUpperCase() + ticketType.slice(1);

        console.log('Delete ticket action initiated, attempting to export chat logs.');

        const outputFile = `chat_${channel.name}.html`;
        const limit = 1000;
        const tzInfo = 'UTC';
        const militaryTime = true;

        // Export chat logs
        exportChatLogs(config.token, channel.id, outputFile, limit, tzInfo, militaryTime, async (err, filePath) => {
            if (err) {
                console.error('Error exporting chat logs:', err);
                return interaction.followUp({ content: 'Failed to delete the ticket.', ephemeral: true });
            }

            console.log(`Chat logs successfully exported to ${filePath}`);

            // Send the transcript via DM to a specific user (your alt account)
            const transcriptRecipientId = '1271511630278164514'; // Replace with your actual user ID
            const transcriptRecipient = await client.users.fetch(transcriptRecipientId).catch(err => {
                console.error('Error fetching transcript recipient:', err);
                return null;
            });

            if (!transcriptRecipient) {
                return interaction.followUp({ content: 'Failed to fetch the transcript recipient.', ephemeral: true });
            }

            const message = await transcriptRecipient.send({ files: [filePath] }).catch(err => {
                console.error('Error sending transcript:', err);
                return null;
            });

            if (!message || !message.attachments.first()) {
                return interaction.followUp({ content: 'Failed to obtain transcript URL.', ephemeral: true });
            }

            const transcriptUrl = message.attachments.first().url;

            // Update the ticket in the database with the transcript URL
            await pool.execute('UPDATE tickets SET transcript_url = ? WHERE channel_id = ?', [
                transcriptUrl,
                channel.id,
            ]);

            // Build the main log embed
            const logEmbed = new EmbedBuilder()
                .setAuthor({ name: `${ticketTypeCapitalized} Ticket`, iconURL: guild.iconURL({ dynamic: true }) })
                .setTitle(`${ticketCounter} | ${ticketCreatorUsername}`)
                .setColor(0xbd0000) // Dark red for deletions
                .setTimestamp()
                .setDescription(
                    `> **Ticket Deleted ➤** <t:${Math.floor(Date.now() / 1000)}:F>\n` +
                    `> **Deleted by ➤** <@${user.id}>\n` +
                    `> **Reason ➤** \`No reason provided.\``
                );

            // Prepare buttons for logs channel
            const logRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(transcriptUrl)
            );

            // Add specific buttons based on ticket type
            if (ticketType === 'Staff Report') {
                if (ticketData.proof_urls) {
                    logRow.addComponents(
                        new ButtonBuilder()
                            .setLabel('View Evidence')
                            .setStyle(ButtonStyle.Primary)
                            .setCustomId(`evidence_${ticketCounter}`)
                            .setEmoji('📁')
                    );
                }

                // Add "Report Details" button
                logRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Report Details')
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId(`report_details_${ticketCounter}`)
                        .setEmoji('⚠️') // Replaced custom emoji with a standard one for reliability
                );
            } else if (ticketType === 'Partnership') {
                // Add "Partnership Details" button
                logRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Partnership Details')
                        .setStyle(ButtonStyle.Primary)
                        .setCustomId(`partnership_details_${ticketCounter}`)
                        .setEmoji('🤝') // Replaced custom emoji with a standard one for reliability
                );
            }

            // Determine the appropriate logs channel based on ticket type
            let logsChannelId;
            if (ticketType === 'Staff Report' || ticketType === 'Partnership') {
                logsChannelId = config.ticketLogsChannelId2;
            } else {
                logsChannelId = config.ticketLogsChannelId1;
            }

            const logsChannel = await guild.channels.fetch(logsChannelId).catch(err => {
                console.error(`Error fetching logs channel with ID ${logsChannelId}:`, err);
                return null;
            });

            if (!logsChannel) {
                console.error(`Logs channel with ID ${logsChannelId} not found.`);
                return interaction.followUp({ content: 'Failed to locate the logs channel.', ephemeral: true });
            }

            await logsChannel.send({ embeds: [logEmbed], components: [logRow] }).catch(err => {
                console.error('Error sending log embed to the logs channel:', err);
            });
            console.log('Log embed sent to the logs channel.');

            // Build the embed for the user (DM) with only the "View Transcript" button
            const userLogEmbed = new EmbedBuilder(logEmbed.toJSON()); // Use toJSON for cloning

            // Prepare buttons for user DM
            const userRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel('View Transcript')
                    .setStyle(ButtonStyle.Link)
                    .setURL(transcriptUrl)
            );

            // Send the embed to the ticket creator (DM)
            if (ticketCreator) {
                await ticketCreator.send({ embeds: [userLogEmbed], components: [userRow] }).catch(err => {
                    console.error(`Error sending DM to user ${ticketCreator.user.tag}:`, err);
                });
                console.log(`Log embed sent to user DM: ${ticketCreator.user.tag}`);
            }

            // Remove the exported chat log file after uploading
            fs.unlink(filePath, (unlinkErr) => {
                if (unlinkErr) {
                    console.error('Error deleting the exported chat log file:', unlinkErr);
                } else {
                    console.log('Exported chat log file deleted:', filePath);
                }
            });

            // Send a confirmation message before deleting the channel
            await interaction.followUp({ content: 'Ticket successfully deleted.', ephemeral: true });

            // Delete the ticket channel
            await channel.delete().catch(err => {
                console.error(`Error deleting channel ${channel.name}:`, err);
            });
            console.log(`Ticket channel ${channel.name} deleted.`);
        }); // <-- Added missing closing parenthesis and semicolon for exportChatLogs callback
    } catch (error) {
        console.error('Error deleting the ticket:', error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Failed to delete the ticket.', ephemeral: true });
        } else {
            await interaction.reply({ content: 'Failed to delete the ticket.', ephemeral: true });
        }
    }
};
