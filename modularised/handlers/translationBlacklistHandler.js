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
    const allowedRoleIds = [
        config.AdminRoleId,
        config.ManagerRoleId,
        config.HeadDeveloperRoleId,
        config.OwnerRoleId,
    ];
    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    if (!hasPermission) {
        const embed = createInsufficientPermissionsEmbed(guild, allowedRoleIds, interaction);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    const durationMs = ms(duration);
    if (!durationMs) {
        return interaction.reply({
            content: 'Invalid duration format. Please use formats like `10m`, `1h`, `1d`.',
            ephemeral: true,
        });
    }
    const pool = client.pool;
    if (await isUserBlacklisted(user.id, pool)) {
        return interaction.reply({
            content: 'This user is already blacklisted.',
            ephemeral: true,
        });
    }
    await interaction.deferReply({ ephemeral: true });
    await blacklistUser(user.id, null, null, reason, interaction.user.id, durationMs, pool);
    await sendBlacklistNotification(client, user, interaction, reason, pool);
    await interaction.editReply({
        content: `${user.tag} has been blacklisted for ${duration}.`,
        ephemeral: true,
    });
    setTimeout(async () => {
        await unblacklistUser(user.id, pool);
        console.log(`User ${user.id} has been automatically unblacklisted after ${duration}.`);
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
    const allowedRoleIds = [
        config.AdminRoleId,
        config.ManagerRoleId,
        config.HeadDeveloperRoleId,
        config.OwnerRoleId,
    ];
    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    if (!hasPermission) {
        const embed = createInsufficientPermissionsEmbed(guild, allowedRoleIds, interaction);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const pool = client.pool;
    if (!(await isUserBlacklisted(user.id, pool))) {
        return interaction.editReply({
            content: 'This user is not blacklisted.',
            ephemeral: true,
        });
    }
    await unblacklistUser(user.id, pool);
    if (config.translationChannelId) {
        const translatorChannel = client.channels.cache.get(config.translationChannelId);
        if (translatorChannel) {
            const blacklistEntryQuery = `SELECT notification_message_id FROM translation_blacklist WHERE user_id = ?`;
            const [rows] = await pool.execute(blacklistEntryQuery, [user.id]);
            if (rows.length > 0 && rows[0].notification_message_id) {
                try {
                    const notificationMessage = await translatorChannel.messages.fetch(rows[0].notification_message_id);
                    const embed = notificationMessage.embeds[0];
                    const updatedEmbed = EmbedBuilder.from(embed)
                        .setColor('#228B22') 
                        .setFooter({ text: `User has been Unblacklisted` });

                    const disabledButton = ButtonBuilder.from(notificationMessage.components[0].components[0])
                        .setDisabled(true)
                        .setLabel('Blacklist Removed')
                        .setEmoji('✅');

                    const row = new ActionRowBuilder().addComponents(disabledButton);

                    await notificationMessage.edit({ embeds: [updatedEmbed], components: [row] });
                } catch (error) {
                    if (error.code === 10008) { 
                        console.warn(`Notification message for user ${user.id} does not exist.`);
                    } else {
                        console.error(`Failed to fetch or edit notification message for user ${user.id}:`, error);
                    }
                }
            }
        }
    }
    await interaction.editReply({
        content: `${user.tag} has been unblacklisted.`,
        ephemeral: true,
    });
    const translatorChannel = client.channels.cache.get(config.translationChannelId);
    if (translatorChannel) {
        await translatorChannel.send(`<@${user.id}> has been unblacklisted manually by <@${interaction.user.id}>.`);
    }
}

module.exports = {
    handleTranslationBlacklist,
    handleTranslationUnblacklist,
};
