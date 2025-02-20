                const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');

// Reuse the same helper to get the Premium role color.
function getPremiumEmbedColor(interaction) {
    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);
    return premiumRole?.color || 0xc79504;
}

/**
 * Handles the pagination buttons for the Premium Members List.
 * @param {Interaction} interaction 
 * @param {String} customId 
 */
async function handlePremiumPagination(interaction, customId) {
    try {
        const [action, type, userId, currentPageStr] = customId.split('_');

        // Ensure only the user who initiated the command can interact with these buttons.
        if (userId !== interaction.user.id) {
            console.log(`Unauthorized interaction from user ${interaction.user.id} for customId ${customId}`);
            // Send an ephemeral message if the wrong user clicks the button.
            return interaction.reply({
                content: 'Only the user who initiated this command can interact with these buttons.',
                ephemeral: true,
            });
        }

        // Acknowledge the interaction without sending a message immediately.
        await interaction.deferUpdate();

        let currentPage = parseInt(currentPageStr);
        const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);

        if (!premiumRole) {
            console.error('Premium role not found.');
            return interaction.editReply({
                content: 'Premium role not found.',
                components: [],
                embeds: [],
            });
        }

        // Force fetch guild members so that the cache is up-to-date.
        await interaction.guild.members.fetch();

        // Fetch all members with the Premium role.
        const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(premiumRole.id));
        const membersArray = Array.from(membersWithRole.values());
        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with Premium role found.\n```')
                .setColor(0xe74c3c);
            return interaction.editReply({ embeds: [noMembersEmbed], components: [] });
        }

        // Adjust page number based on action.
        if (action === 'next') {
            currentPage += 1;
        } else if (action === 'prev') {
            currentPage -= 1;
        }

        // Validate page number.
        if (currentPage < 0) currentPage = 0;
        if (currentPage >= totalPages) currentPage = totalPages - 1;

        const paginatedMembers = membersArray.slice(
            currentPage * pageSize,
            (currentPage + 1) * pageSize
        );

        const memberList = paginatedMembers
            .map((member, index) => `\`\`${index + 1 + currentPage * pageSize}.\`\` <@${member.id}>`)
            .join('\n');

        const userPosition = membersArray.findIndex(member => member.id === interaction.user.id) + 1;
        const listEmbed = new EmbedBuilder()
            .setAuthor({ name: 'Premium Members List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **Premium** [${currentPage + 1}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({
                text: `${userPosition > 0 ? userPosition : 'N/A'}. [${interaction.user.username}]`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor(getPremiumEmbedColor(interaction));

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

        // Update the message where the button was clicked.
        await interaction.editReply({ embeds: [listEmbed], components: [buttons] });
        console.log(`User ${interaction.user.id} navigated to page ${currentPage + 1}/${totalPages} of Premium Members List.`);
    } catch (error) {
        console.error(`Error in handlePremiumPagination for customId ${customId}:`, error);
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp({
                content: 'An error occurred while processing your request.',
                ephemeral: true,
            });
        } else {
            await interaction.reply({
                content: 'An error occurred while processing your request.',
                ephemeral: true,
            });
        }
    }
}




module.exports = { handlePremiumPagination };
