// utilities/translationBlacklistUtils.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { getPermissionOverwrites } = require('./permissions');
const config = require('../config/config');

/**
 * Check if a user is blacklisted.
 * @param {string} userId - The ID of the user.
 * @param {object} pool - The MySQL pool.
 * @returns {boolean} - True if blacklisted, else false.
 */
async function isUserBlacklisted(userId, pool) {
    const query = `SELECT * FROM translation_blacklist WHERE user_id = ? LIMIT 1`;
    const [rows] = await pool.execute(query, [userId]);
    return rows.length > 0;
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
    const query = `
        INSERT INTO translation_blacklist (user_id, message_id, channel_id, blacklist_reason, issued_by, custom_duration, blacklist_timestamp)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;
    await pool.execute(query, [userId, messageId, channelId, reason, issuedBy, customDuration]);
    console.log(`User ${userId} has been blacklisted.`);
}

/**
 * Remove a user from the blacklist.
 * @param {string} userId 
 * @param {object} pool 
 */
async function unblacklistUser(userId, pool) {
    const deleteBlacklistQuery = `DELETE FROM translation_blacklist WHERE user_id = ?`;
    await pool.execute(deleteBlacklistQuery, [userId]);
    console.log(`User ${userId} has been unblacklisted.`);
}

/**
 * Store the notification message ID after sending a blacklist notification.
 * @param {string} userId 
 * @param {string} messageId 
 * @param {object} pool 
 */
async function storeNotificationMessageId(userId, messageId, pool) {
    const query = `
        UPDATE translation_blacklist
        SET notification_message_id = ?
        WHERE user_id = ?
    `;
    await pool.execute(query, [messageId, userId]);
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
    const translatorChannel = client.channels.cache.get(config.translationChannelId);
    if (!translatorChannel) {
        console.error('Translator channel not found.');
        return;
    }

    const blacklistEmbed = new EmbedBuilder()
        .setColor('#974300')
        .setAuthor({ name: user.username, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setTitle('Translation Blacklist <:ban:1298248109201035264>')
        .setDescription(`**User:** <@${user.id}>\n**Issued by:** System\n**Reason:**\n> ${reason}`)
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
    await storeNotificationMessageId(user.id, sentMessage.id, pool);

    console.log(`Blacklist notification for user ${user.id} sent and stored with message ID ${sentMessage.id}`);
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
