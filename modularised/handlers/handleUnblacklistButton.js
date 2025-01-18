// handlers/handleUnblacklistButton.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { isUserBlacklisted, unblacklistUser } = require('../utilities/translationBlacklistUtils');
const config = require('../config/config');

/**
 * Handles the 'unblacklist_' button interactions.
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handleUnblacklistButton(interaction, client) {
    const userId = interaction.customId.split('_')[1]; // Extract the user ID from the button's custom ID

    // Check if the user is blacklisted
    const isBlacklisted = await isUserBlacklisted(userId, client.pool);
    if (!isBlacklisted) {
        return interaction.reply({ content: 'This user is not blacklisted.', ephemeral: true });
    }

    // Unblacklist the user
    await unblacklistUser(userId, client.pool);

    // Get the original embed message that triggered the button
    const originalMessage = interaction.message;

    // Clone the existing embed and modify it
    const embed = originalMessage.embeds[0]; // Get the first embed from the original message

    const updatedEmbed = EmbedBuilder.from(embed)
        .setColor('#228B22') // Dark green color
        .setFooter({ text: `User has been Unblacklisted` });

    // Disable the unblacklist button
    const disabledButton = ButtonBuilder.from(interaction.component)
        .setDisabled(true)
        .setLabel('Blacklist Removed')
        .setEmoji('✅');

    const row = new ActionRowBuilder().addComponents(disabledButton);

    // Edit the original message to update the embed and disable the button
    await interaction.update({ embeds: [updatedEmbed], components: [row] });

    // Notify the moderator that the user has been unblacklisted and counts reset
    await interaction.followUp({ content: `<@${userId}> has been unblacklisted and their translation counts have been reset.`, ephemeral: true });
}

module.exports = handleUnblacklistButton;
