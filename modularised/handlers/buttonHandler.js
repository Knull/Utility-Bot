// handlers/buttonHandler.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
    isUserBlacklisted,
    unblacklistUser,
} = require('../utilities/translationBlacklistUtils');
const config = require('../config/config');

/**
 * Handles button interactions for unblacklisting users.
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handleButtonInteraction(interaction, client) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Check if the button is an "unblacklist" button
    if (customId.startsWith('unblacklist_')) {
        const userId = customId.split('_')[1]; // Extract the user ID from the button's custom ID

        try {
            const pool = client.pool;

            // Check if the user is blacklisted
            const userIsBlacklisted = await isUserBlacklisted(userId, pool);

            if (userIsBlacklisted) {
                // Unblacklist the user
                await unblacklistUser(userId, pool);
                console.log(`User ${userId} has been unblacklisted successfully.`);
            } else {
                console.log(`User ${userId} is no longer in the blacklist.`);
                // Continue with UI updates even if the user was already removed
            }

            // Get the original embed message that triggered the button
            const originalMessage = interaction.message;

            // Clone the existing embed and modify it
            const embed = originalMessage.embeds[0]; // Get the first embed from the original message

            const updatedEmbed = EmbedBuilder.from(embed)  // Clone the existing embed
                .setColor('#228B22')                      // Change color to dark green
                .setFooter({ text: `User has been Unblacklisted` }); // Update the footer

            // Disable the unblacklist button
            const disabledButton = ButtonBuilder.from(interaction.component)
                .setDisabled(true)  // Disable the button
                .setLabel('Blacklist Removed') // Optionally change the label
                .setEmoji('✅'); // Optionally change the emoji

            const row = new ActionRowBuilder().addComponents(disabledButton);

            // Edit the original message to update the embed and disable the button
            await interaction.update({ embeds: [updatedEmbed], components: [row] });

            // Notify the moderator that the user has been unblacklisted and counts reset
            await interaction.followUp({ content: `<@${userId}> has been unblacklisted and their translation counts have been reset.`, ephemeral: true });

        } catch (error) {
            console.error('Failed to unblacklist the user:', error);
            await interaction.reply({ content: 'There was an error unblacklisting the user.', ephemeral: true });
        }
    }
}

module.exports = { handleButtonInteraction };
