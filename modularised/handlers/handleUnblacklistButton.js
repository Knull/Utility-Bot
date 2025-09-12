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
    const userId = interaction.customId.split('_')[1]; 
    const isBlacklisted = await isUserBlacklisted(userId, client.pool);
    if (!isBlacklisted) {
        return interaction.reply({ content: 'This user is not blacklisted.', ephemeral: true });
    }
    await unblacklistUser(userId, client.pool);
    const originalMessage = interaction.message;
    const embed = originalMessage.embeds[0]; 

    const updatedEmbed = EmbedBuilder.from(embed)
        .setColor('#228B22') // Dark green color
        .setFooter({ text: `User has been Unblacklisted` });
    const disabledButton = ButtonBuilder.from(interaction.component)
        .setDisabled(true)
        .setLabel('Blacklist Removed')
        .setEmoji('✅');

    const row = new ActionRowBuilder().addComponents(disabledButton);
    await interaction.update({ embeds: [updatedEmbed], components: [row] });
    await interaction.followUp({ content: `<@${userId}> has been unblacklisted and their translation counts have been reset.`, ephemeral: true });
}

module.exports = handleUnblacklistButton;
