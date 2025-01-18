// utilities/translationBlacklistUtils.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getPermissionOverwrites } = require('./permissions'); // Ensure this utility exists and functions correctly
const config = require('../config/config');

/**
 * Check if a user is blacklisted.
 * @param {string} userId - The ID of the user.
 * @param {object} pool - The MySQL pool.
 * @returns {boolean} - True if blacklisted, else false.
 */
async function isUserBlacklisted(userId, pool) {
    try {
        const query = `SELECT * FROM translation_blacklist WHERE user_id = ? LIMIT 1`;
        const [rows] = await pool.execute(query, [userId]);
        return rows.length > 0;
    } catch (error) {
        console.error(`Error checking blacklist status for user ${userId}:`, error);
        return false;
    }
}

/**
 * Add a user to the blacklist.
 * @param {string} userId 
 * @param {string} messageId 
 * @param {string} channelId 
 * @param {string} reason 
 * @param {string} issuedBy 
 * @param {boolean|string} customDuration 
 * @param {object} pool 
 */
async function blacklistUser(userId, messageId, channelId, reason, issuedBy, customDuration, pool) {
    try {
        const query = `
            INSERT INTO translation_blacklist (user_id, message_id, channel_id, blacklist_reason, issued_by, custom_duration, blacklist_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                message_id = VALUES(message_id),
                channel_id = VALUES(channel_id),
                blacklist_reason = VALUES(blacklist_reason),
                issued_by = VALUES(issued_by),
                custom_duration = VALUES(custom_duration),
                blacklist_timestamp = VALUES(blacklist_timestamp)
        `;
        await pool.execute(query, [userId, messageId, channelId, reason, issuedBy, customDuration]);
        console.log(`User ${userId} has been blacklisted.`);
    } catch (error) {
        console.error(`Error blacklisting user ${userId}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

/**
 * Remove a user from the blacklist.
 * @param {string} userId 
 * @param {object} pool 
 */
async function unblacklistUser(userId, pool) {
    try {
        const deleteBlacklistQuery = `DELETE FROM translation_blacklist WHERE user_id = ?`;
        await pool.execute(deleteBlacklistQuery, [userId]);
        console.log(`User ${userId} has been unblacklisted.`);
    } catch (error) {
        console.error(`Error unblacklisting user ${userId}:`, error);
        throw error; // Re-throw the error to be handled by the caller
    }
}

/**
 * Store the notification message ID after sending a blacklist notification.
 * @param {string} userId 
 * @param {string} messageId 
 * @param {object} pool 
 */
async function storeNotificationMessageId(userId, messageId, pool) {
    try {
        const query = `
            UPDATE translation_blacklist
            SET notification_message_id = ?
            WHERE user_id = ?
        `;
        await pool.execute(query, [messageId, userId]);
        console.log(`Stored notification message ID ${messageId} for user ${userId}.`);
    } catch (error) {
        console.error(`Error storing notification message ID for user ${userId}:`, error);
    }
}

/**
 * Send a blacklist notification to the translator channel.
 * @param {object} client 
 * @param {object} user - Discord user object.
 * @param {object} message - Discord message object.
 * @param {string} reason 
 * @param {object} pool 
 */
async function sendBlacklistNotification(client, user, message, reason, pool) {
    try {
        const translatorChannel = client.channels.cache.get(config.translationChannelId);
        if (!translatorChannel) {
            console.error('Translator channel not found.');
            return;
        }

        const blacklistEmbed = new EmbedBuilder()
            .setColor('#974300')
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
            .setTitle('Translation Blacklist <:ban:1298248109201035264>') // Ensure the emoji exists or replace it
            .setDescription(`**User:** <@${user.id}>\n**Issued by:** System\n**Reason:**\n> ${reason}`)
            .setThumbnail(message.guild.iconURL({ dynamic: true }))
            .setFooter({ text: 'Click the button to unblacklist', iconURL: message.guild.iconURL({ dynamic: true }) })
            .setTimestamp();

        const unblacklistButton = new ButtonBuilder()
            .setCustomId(`unblacklist_${user.id}`)
            .setLabel('Remove Blacklist')
            .setEmoji('⚖️') // Ensure the emoji exists or replace it
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(unblacklistButton);

        // Send the embed and store the message reference
        const sentMessage = await translatorChannel.send({ embeds: [blacklistEmbed], components: [row] });

        // Store the notification message ID in the database with the blacklist info
        await storeNotificationMessageId(user.id, sentMessage.id, pool);

        console.log(`Blacklist notification for user ${user.id} sent and stored with message ID ${sentMessage.id}`);
    } catch (error) {
        console.error(`Error sending blacklist notification for user ${user.id}:`, error);
    }
}

/**
 * Create an embed for insufficient permissions.
 * @param {object} guild 
 * @param {string[]} allowedRoleIds 
 * @param {object} interaction 
 * @returns {EmbedBuilder}
 */
function createInsufficientPermissionsEmbed(guild, allowedRoleIds, interaction) {
    const roleMentions = allowedRoleIds.map(roleId => `<@&${roleId}>`).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#FF0000') // Red color for error
        .setTitle('Insufficient Permissions')
        .setDescription(`Only members with the following roles can use this command:\n${roleMentions}`)
        .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
        .setTimestamp();

    return embed;
}

/**
 * Capitalizes the first letter of a string.
 * @param {string} string 
 * @returns {string}
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = {
    isUserBlacklisted,
    blacklistUser,
    unblacklistUser,
    sendBlacklistNotification,
    createInsufficientPermissionsEmbed,
    capitalizeFirstLetter,
};
