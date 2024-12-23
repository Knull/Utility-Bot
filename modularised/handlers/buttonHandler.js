// handlers/buttonHandler.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config/config');

/**
 * Handles button interactions for unblacklist and premium list pagination.
 * @param {Interaction} interaction 
 * @param {Client} client 
 */
async function handleButtonInteraction(interaction, client) {
    if (!interaction.isButton()) return;

    const customId = interaction.customId;

    // Handle Unblacklist Buttons
    if (customId.startsWith('unblacklist_')) {
        const userId = customId.split('_')[1]; // Extract the user ID from the button's custom ID

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

    // Handle Pagination Buttons for Premium List
    else if (customId.startsWith('prev_premium_') || customId.startsWith('next_premium_')) {
        const [action, , userId, currentPageStr] = customId.split('_');

        // Ensure only the user who initiated the command can interact with these buttons
        if (userId !== interaction.user.id) {
            return interaction.reply({
                content: 'Only the user who initiated this command can interact with these buttons.',
                ephemeral: true,
            });
        }

        let currentPage = parseInt(currentPageStr);
        const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);

        if (!premiumRole) {
            return interaction.update({
                content: 'Premium role not found.',
                components: [],
                embeds: [],
            });
        }

        // Fetch all members with the Premium role
        const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(premiumRole.id));
        const membersArray = Array.from(membersWithRole.values());

        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with Premium role found.\n```')
                .setColor(0x980e00); // Dark red color
            return interaction.update({ embeds: [noMembersEmbed], components: [] });
        }

        if (action === 'next') {
            currentPage += 1;
        } else if (action === 'prev') {
            currentPage -= 1;
        }

        // Validate page number
        if (currentPage < 0) currentPage = 0;
        if (currentPage >= totalPages) currentPage = totalPages - 1;

        const paginatedMembers = membersArray.slice(
            currentPage * pageSize,
            (currentPage + 1) * pageSize
        );

        const memberList = paginatedMembers
            .map(
                (member, index) =>
                    `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`
            )
            .join('\n');

        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;

        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Premium Members List', iconURL: interaction.guild.iconURL() })
            .setDescription(
                `Mode: **Premium** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`
            )
            .setFooter({
                text: `${userPosition > 0 ? userPosition : 'N/A'}. [${interaction.user.username}]`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor('#c79504'); // Gold color

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_premium_${interaction.user.id}_${currentPage}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`next_premium_${interaction.user.id}_${currentPage}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages - 1)
        );

        await interaction.update({ embeds: [listEmbed], components: [buttons] });
    }
}

    /**
     * Checks if a user is blacklisted.
     * @param {string} userId 
     * @param {object} pool 
     * @returns {boolean}
     */
    async function isUserBlacklisted(userId, pool) {
        const query = `SELECT * FROM translation_blacklist WHERE user_id = ? LIMIT 1`;
        const [rows] = await pool.execute(query, [userId]);
        return rows.length > 0;
    }

    /**
     * Removes a user from the blacklist.
     * @param {string} userId 
     * @param {object} pool 
     */
    async function unblacklistUser(userId, pool) {
        const deleteBlacklistQuery = `DELETE FROM translation_blacklist WHERE user_id = ?`;
        await pool.execute(deleteBlacklistQuery, [userId]);
        console.log(`User ${userId} has been unblacklisted.`);
    }

    module.exports = { handleButtonInteraction };
