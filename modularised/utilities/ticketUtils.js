// utilities/ticketUtils.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config/config');
const { pool } = require('../database'); // Central database module
const axios = require('axios');
/**
 * Fetches and returns the appropriate category ID based on ticket type and archival status.
 * @param {string} ticketType 
 * @param {boolean} isArchived 
 * @returns {string} categoryId
 */
function getCategoryId(ticketType, isArchived = false) {
    const categoryMapping = {
        'General': isArchived ? config.archivedGeneralTicketsCategoryId : config.generalTicketsCategoryId,
        'Appeal': isArchived ? config.archivedAppealTicketsCategoryId : config.appealTicketsCategoryId,
        'Staff Report': isArchived ? config.archivedStaffReportTicketsCategoryId : config.staffReportTicketsCategoryId,
        'Partnership': isArchived ? config.archivedPartnershipTicketsCategoryId : config.partnershipTicketsCategoryId,
        'Store': isArchived ? config.archivedStoreTicketsCategoryId : config.storeTicketsCategoryId,
    };

    return categoryMapping[ticketType] || (isArchived ? config.archivedTicketsCategoryId : config.ticketsCategoryId);
}

/**
 * Retrieves permission overwrites for a ticket channel.
 * @param {Guild} guild 
 * @param {string} userId 
 * @param {string} ticketType 
 * @returns {Array} permissionOverwrites
 */
function getPermissionOverwrites(guild, userId, ticketType) {
    const overwrites = [
        {
            id: guild.roles.everyone.id,
            deny: ['ViewChannel'],
        },
        {
            id: userId,
            allow: ['ViewChannel', 'SendMessages'],
        },
    ];

    if (['General', 'Store'].includes(ticketType)) {
        overwrites.push({
            id: config.staffRoleId,
            allow: ['ViewChannel', 'SendMessages'],
        });
    } else if (['Staff Report', 'Partnership'].includes(ticketType)) {
        overwrites.push({
            id: config.adminRoleId,
            allow: ['ViewChannel', 'SendMessages'],
        });
    } else if (ticketType === 'Appeal') {
        overwrites.push(
            {
                id: config.staffRoleId,
                deny: ['ViewChannel', 'SendMessages'],
            },
            {
                id: config.adminRoleId,
                allow: ['ViewChannel', 'SendMessages'],
            }
        );
    }

    return overwrites;
}

/**
 * Sends an embed to a channel and returns the sent message.
 * @param {GuildChannel} channel 
 * @param {EmbedBuilder} embed 
 * @param {ActionRowBuilder} components 
 * @returns {Promise<Message>}
 */
async function sendEmbed(channel, embed, components) {
    const payload = { embeds: [embed] };
    if (components) payload.components = [components];

    try {
        console.log(`Sending embed to channel ${channel.id}.`);
        const message = await channel.send(payload);
        console.log(`Embed sent successfully. Message ID: ${message.id}`);
        return message;
    } catch (error) {
        console.error('Failed to send embed:', error);
        throw error;
    }
}

/**
 * Sends a plain text message to a channel.
 * @param {GuildChannel} channel 
 * @param {string} content 
 * @returns {Promise<Message>}
 */
async function sendPlainText(channel, content) {
    try {
        return await channel.send(content);
    } catch (error) {
        console.error('Failed to send plain text message:', error);
        throw error;
    }
}
/**
 * Validates whether a given URL points to an allowed media type.
 * @param {string} url - The URL to validate.
 * @returns {Promise<boolean>} - Returns true if valid, else false.
 */
async function isValidMediaUrl(url) {
    try {
        const response = await axios.head(url, { timeout: 5000 });
        const contentType = response.headers['content-type'];
        // Define allowed MIME types
        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'video/mp4',
            'video/mpeg',
            'video/quicktime',
            'application/pdf', // If PDFs are allowed as proof
            // Add more as needed
        ];
        return allowedTypes.includes(contentType);
    } catch (error) {
        console.error(`Failed to validate URL: ${url}`, error.message);
        return false;
    }
}

/**
 * Validates a Discord invite link.
 * @param {Client} client - The Discord client.
 * @param {string} inviteLink - The invite link to validate.
 * @returns {Promise<boolean>} - Returns true if valid, else false.
 */
async function validateDiscordInvite(client, inviteLink) {
    try {
        const invite = await client.fetchInvite(inviteLink);
        return !!invite;
    } catch (error) {
        console.error('Invite validation error:', error.message);
        return false;
    }
}
module.exports = {
    getCategoryId,
    getPermissionOverwrites,
    sendEmbed,
    sendPlainText,
    isValidMediaUrl,
    validateDiscordInvite,
};
