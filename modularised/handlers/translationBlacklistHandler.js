// handlers/translationBlacklistHandler.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ms = require('ms'); // Install this package for duration parsing
const {
    isUserBlacklisted,
    blacklistUser,
    unblacklistUser,
    sendBlacklistNotification,
    createInsufficientPermissionsEmbed,
    capitalizeFirstLetter,
} = require('../utilities/translationBlacklistUtils');
const config = require('../config/config');

/**
 * Handles the /translation_blacklist command
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handleTranslationBlacklist(interaction, client) {
    const { options, guild, member, client: botClient } = interaction;

    const user = options.getUser('user');
    const duration = options.getString('duration');
    const reason = options.getString('reason') || 'No reason provided';

    // Define roles that can use the command
    const allowedRoleIds = [
        config.AdminRoleId,
        config.ManagerRoleId,
        config.HeadDeveloperRoleId,
        config.OwnerRoleId,
    ];

    // Check if the user has one of the allowed roles
    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    if (!hasPermission) {
        const embed = createInsufficientPermissionsEmbed(guild, allowedRoleIds, interaction);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Parse duration
    const durationMs = ms(duration);
    if (!durationMs) {
        return interaction.reply({
            content: 'Invalid duration format. Please use formats like `10m`, `1h`, `1d`.',
            ephemeral: true,
        });
    }

    // Check if the user is already blacklisted
    const pool = client.pool;
    if (await isUserBlacklisted(user.id, pool)) {
        return interaction.reply({
            content: 'This user is already blacklisted.',
            ephemeral: true,
        });
    }

    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Blacklist the user
    await blacklistUser(user.id, null, null, reason, interaction.user.id, durationMs, pool);

    // Send a notification to the translator channel
    await sendBlacklistNotification(client, user, interaction, reason, pool);

    // Respond to the command issuer
    await interaction.editReply({
        content: `${user.tag} has been blacklisted for ${duration}.`,
        ephemeral: true,
    });

    // Schedule unblacklisting
    setTimeout(async () => {
        await unblacklistUser(user.id, pool);
        console.log(`User ${user.id} has been automatically unblacklisted after ${duration}.`);

        // Optionally, send a message to the translator channel about the automatic unblacklist
        const translatorChannel = client.channels.cache.get(config.translationChannelId);
        if (translatorChannel) {
            await translatorChannel.send(`<@${user.id}> has been automatically unblacklisted after serving their blacklist duration.`);
        }
    }, durationMs);
}

/**
 * Handles the /translation_unblacklist command
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handleTranslationUnblacklist(interaction, client) {
    const { options, guild, member, client: botClient } = interaction;

    const user = options.getUser('user');

    // Define roles that can use the command
    const allowedRoleIds = [
        config.AdminRoleId,
        config.ManagerRoleId,
        config.HeadDeveloperRoleId,
        config.OwnerRoleId,
    ];

    // Check if the user has one of the allowed roles
    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    if (!hasPermission) {
        const embed = createInsufficientPermissionsEmbed(guild, allowedRoleIds, interaction);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Defer reply
    await interaction.deferReply({ ephemeral: true });

    // Check if the user is blacklisted
    const pool = client.pool;
    if (!(await isUserBlacklisted(user.id, pool))) {
        return interaction.editReply({
            content: 'This user is not blacklisted.',
            ephemeral: true,
        });
    }

    // Unblacklist the user
    await unblacklistUser(user.id, pool);

    // Optionally, update the blacklist notification message if it exists
    // Fetch the notification message
    if (config.translationChannelId) {
        const translatorChannel = client.channels.cache.get(config.translationChannelId);
        if (translatorChannel) {
            // Fetch the message by notification_message_id
            const blacklistEntryQuery = `SELECT notification_message_id FROM translation_blacklist WHERE user_id = ?`;
            const [rows] = await pool.execute(blacklistEntryQuery, [user.id]);
            if (rows.length > 0 && rows[0].notification_message_id) {
                try {
                    const notificationMessage = await translatorChannel.messages.fetch(rows[0].notification_message_id);
                    const embed = notificationMessage.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(embed)
                        .setColor('#228B22') // Dark green
                        .setFooter({ text: `User has been Unblacklisted` });

                    const disabledButton = ButtonBuilder.from(notificationMessage.components[0].components[0])
                        .setDisabled(true)
                        .setLabel('Blacklist Removed')
                        .setEmoji('✅');

                    const row = new ActionRowBuilder().addComponents(disabledButton);

                    await notificationMessage.edit({ embeds: [updatedEmbed], components: [row] });
                } catch (error) {
                    if (error.code === 10008) { // Unknown Message
                        console.warn(`Notification message for user ${user.id} does not exist.`);
                    } else {
                        console.error(`Failed to fetch or edit notification message for user ${user.id}:`, error);
                    }
                }
            }
        }
    }

    // Respond to the command issuer
    await interaction.editReply({
        content: `${user.tag} has been unblacklisted.`,
        ephemeral: true,
    });

    // Notify the translator channel about the unblacklist
    const translatorChannel = client.channels.cache.get(config.translationChannelId);
    if (translatorChannel) {
        await translatorChannel.send(`<@${user.id}> has been unblacklisted manually by <@${interaction.user.id}>.`);
    }
}

module.exports = {
    handleTranslationBlacklist,
    handleTranslationUnblacklist,
};
