const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');
const { pool } = require('../utils/database');

// Function to check if a user is blacklisted
async function isUserBlacklisted(userId) {
    const query = `SELECT * FROM translation_blacklist WHERE user_id = ? LIMIT 1`;
    const [rows] = await pool.execute(query, [userId]);
    return rows.length > 0;
}

// Function to add user to blacklist
async function blacklistUser(userId, messageId, channelId, reason, issuedBy, customDuration = false) {
    const query = `
        INSERT INTO translation_blacklist (user_id, message_id, channel_id, blacklist_reason, issued_by, custom_duration)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(query, [userId, messageId, channelId, reason, issuedBy, customDuration]);
    console.log(`User ${userId} has been blacklisted.`);
}

// Function to remove user from blacklist
async function unblacklistUser(userId) {
    const deleteBlacklistQuery = `DELETE FROM translation_blacklist WHERE user_id = ?`;
    await pool.execute(deleteBlacklistQuery, [userId]);
    console.log(`User ${userId} has been unblacklisted.`);
    // Reaction counts are preserved
    console.log(`Reaction counts for user ${userId} are preserved.`);
}

// Function to send a blacklist notification to the translator channel and store message ID
async function sendBlacklistNotification(client, user, message, reason) {
    const translatorChannel = client.channels.cache.get(config.translationChannelId);
    if (!translatorChannel) {
        console.error('Translation channel not found.');
        return;
    }

    const blacklistEmbed = new EmbedBuilder()
        .setColor('#974300')
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTitle('Translation Blacklist <:ban:1298248109201035264>')
        .setDescription(`**User:** <@${user.id}>\n**Issued by:** <@${message.author.id}>\n**Reason:**\n> ${reason}`)
        .setThumbnail(message.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Click the button to unblacklist', iconURL: message.guild.iconURL({ dynamic: true }) })
        .setTimestamp();

    const unblacklistButton = new ButtonBuilder()
        .setCustomId(`unblacklist_${user.id}`)
        .setLabel('Remove Blacklist')
        .setEmoji('⚖️')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(unblacklistButton);

    // Send the embed and store the message reference
    const sentMessage = await translatorChannel.send({ embeds: [blacklistEmbed], components: [row] });

    // Store the notification message ID in the database with the blacklist info
    const storeMessageIdQuery = `
        UPDATE translation_blacklist
        SET notification_message_id = ?
        WHERE user_id = ?
    `;
    await pool.execute(storeMessageIdQuery, [sentMessage.id, user.id]);

    console.log(`Blacklist notification for user ${user.id} sent and stored with message ID ${sentMessage.id}`);
}

// Function to handle 'translation_blacklist' command
async function handleTranslationBlacklist(interaction) {
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    // Parse duration (Use the `ms` package for parsing durations)
    const ms = require('ms');
    const durationMs = ms(duration);
    if (!durationMs) {
        return interaction.reply({ content: 'Invalid duration format. Use formats like "10m", "1h", "1d".', ephemeral: true });
    }

    // Check if user is already blacklisted
    if (await isUserBlacklisted(user.id)) {
        return interaction.reply({ content: 'This user is already blacklisted.', ephemeral: true });
    }

    // Blacklist the user
    await blacklistUser(user.id, 'manual', 'manual', reason, interaction.user.id, false);

    // Send blacklist notification
    await sendBlacklistNotification(interaction.client, user, interaction, reason);

    interaction.reply({ content: `<@${user.id}> has been blacklisted for ${duration}.`, ephemeral: true });

    // Schedule unblacklist
    setTimeout(async () => {
        await unblacklistUser(user.id);
        console.log(`Automatically unblacklisted user ${user.id} after duration.`);
        // Optionally, send a message to notify unblacklisting
    }, durationMs);
}

// Function to handle 'translation_unblacklist' command
async function handleTranslationUnblacklist(interaction) {
    const user = interaction.options.getUser('user');

    // Check if the user is blacklisted
    if (!await isUserBlacklisted(user.id)) {
        return interaction.reply({ content: 'This user is not blacklisted.', ephemeral: true });
    }

    // Unblacklist the user
    await unblacklistUser(user.id);

    // Update the notification message if exists
    const [rows] = await pool.execute('SELECT * FROM translation_blacklist WHERE user_id = ?', [user.id]);
    if (rows.length > 0 && rows[0].notification_message_id) {
        const translatorChannel = interaction.guild.channels.cache.get(config.translationChannelId);
        if (translatorChannel) {
            try {
                const notificationMessage = await translatorChannel.messages.fetch(rows[0].notification_message_id);
                const embed = EmbedBuilder.from(notificationMessage.embeds[0])
                    .setColor('#228B22') // Change color to dark green
                    .setFooter({ text: 'User has been Unblacklisted' });

                const disabledButton = new ButtonBuilder()
                    .setCustomId(`unblacklist_${user.id}`)
                    .setLabel('Remove Blacklist')
                    .setEmoji('⚖️')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true);

                const row = new ActionRowBuilder().addComponents(disabledButton);

                await notificationMessage.edit({ embeds: [embed], components: [row] });
            } catch (error) {
                console.error(`Error updating blacklist notification message for user ${user.id}:`, error);
            }
        }
    }

    interaction.reply({ content: `<@${user.id}> has been unblacklisted.`, ephemeral: true });
}

module.exports = { handleTranslationBlacklist, handleTranslationUnblacklist, blacklistUser, unblacklistUser, isUserBlacklisted, sendBlacklistNotification };
