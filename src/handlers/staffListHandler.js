// handlers/staffListHandler.js

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');
const logger = require('../utilities/logger'); 

const staffRoles = [
    config.OwnerRoleId,
    config.HeadDeveloperRoleId,
    config.ManagerRoleId,
    config.DeveloperRoleId,
    config.DesignerRoleId,
    config.AdminRoleId,
    config.ModRoleId,
    config.HelperRoleId,
    config.SeniorAdminRoleId, 
];

const allStaffRoles = [
    { name: 'Owner', id: config.OwnerRoleId },
    { name: 'Head Developer', id: config.HeadDeveloperRoleId },
    { name: 'Manager', id: config.ManagerRoleId },
    { name: 'Developer', id: config.DeveloperRoleId },
    { name: 'Designer', id: config.DesignerRoleId },
    { name: 'Sr. Admin',  id: config.SeniorAdminRoleId }, 
    { name: 'Admin', id: config.AdminRoleId },
    { name: 'Mod', id: config.ModRoleId },
    { name: 'Helper', id: config.HelperRoleId },
    { name: 'Staff Base Role', id: config.staffRoleId },
];

/**
 * Creates an embed for a specific page of the staff list.
 * @param {number} page - Current page number.
 * @param {Array} sortedMembersArray - Array of sorted guild members.
 * @param {Guild} guild - The Discord guild.
 * @param {Interaction} interaction - The interaction object.
 * @param {number} totalPages - Total number of pages.
 * @param {string} embedTitleMode - The mode/title of the embed.
 * @returns {EmbedBuilder} - The constructed embed.
 */
function getPageEmbed(page, sortedMembersArray, guild, interaction, totalPages, embedTitleMode) {
    const pageSize = 10;
    const pageStartIndex = (page - 1) * pageSize;
    const pageMembers = sortedMembersArray.slice(pageStartIndex, pageStartIndex + pageSize);

    const embed = new EmbedBuilder()
        .setAuthor({ name: `Staff List`, iconURL: guild.iconURL({ dynamic: true }) })
        .setTitle(`Mode: ${embedTitleMode} [${page}/${totalPages}]`)
        .setDescription(
            `▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
            pageMembers.map((member, i) => `\`${pageStartIndex + i + 1}.\` <@${member.id}>`).join('\n') +
            `\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`
        )
        .setFooter({
            text: `${sortedMembersArray.length} Staff Members`,
            iconURL: guild.iconURL({ dynamic: true }),
        })
        .setColor(0x264AFF)
        .setTimestamp();

    return embed;
}

/**
 * Creates pagination buttons for navigating through staff list pages.
 * @param {number} page - Current page number.
 * @param {number} totalPages - Total number of pages.
 * @param {string} userId - ID of the user who initiated the interaction.
 * @returns {ActionRowBuilder} - The row of pagination buttons.
 */
function getPaginationButtons(page, totalPages, userId) {
    const prevButton = new ButtonBuilder()
        .setCustomId(`stafflist_prev_${userId}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
        .setDisabled(page === 1);

    const nextButton = new ButtonBuilder()
        .setCustomId(`stafflist_next_${userId}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('➡️')
        .setDisabled(page === totalPages);

    return new ActionRowBuilder().addComponents(prevButton, nextButton);
}

module.exports = {
    /**
     * Handles the staff list command interaction.
     * @param {Interaction} interaction - The command interaction.
     * @param {Object} config - The configuration object.
     */
    async handleStaffListCommand(interaction, config) {
        try {
            await interaction.deferReply(); // Defer reply to avoid interaction timeout

            const sortBy = interaction.options.getString('sort-by');
            const order = interaction.options.getString('order') || 'ascending';
            const guild = interaction.guild;

            await guild.members.fetch();

            const selectedRole = allStaffRoles.find(role => role.name.toLowerCase() === sortBy?.toLowerCase());
            const memberList = guild.members.cache.filter(member => {
                if (selectedRole) return member.roles.cache.has(selectedRole.id);
                return member.roles.cache.some(role => allStaffRoles.map(r => r.id).includes(role.id));
            });

            const sortedMembersArray = Array.from(memberList.values()).sort((a, b) => {
                const roleIndexA = allStaffRoles.findIndex(role => a.roles.cache.has(role.id));
                const roleIndexB = allStaffRoles.findIndex(role => b.roles.cache.has(role.id));
                return order === 'ascending' ? roleIndexA - roleIndexB : roleIndexB - roleIndexA;
            });

            const pageSize = 10;
            const totalPages = Math.ceil(sortedMembersArray.length / pageSize);
            let currentPage = 1;
            const embedTitleMode = selectedRole ? selectedRole.name : 'Staff';

            const embed = getPageEmbed(currentPage, sortedMembersArray, guild, interaction, totalPages, embedTitleMode);
            const buttons = getPaginationButtons(currentPage, totalPages, interaction.user.id);
            await interaction.editReply({ embeds: [embed], components: [buttons], fetchReply: true });

            logger.info(`Staff list command executed by user ${interaction.user.id}. Total staff members: ${sortedMembersArray.length}`);
        } catch (error) {
            logger.error(`Error in handleStaffListCommand: ${error}`);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: 'There was an error while executing this command!', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'There was an error while executing this command!', 
                    ephemeral: true 
                });
            }
        }
    },

    /**
     * Handles pagination button interactions for the staff list.
     * @param {Interaction} interaction - The button interaction.
     */
    async handlePagination(interaction) {
        try {
            const [prefix, action, userId] = interaction.customId.split('_');

            // Ensure only the user who initiated the command can interact
            if (interaction.user.id !== userId) {
                return interaction.reply({ 
                    content: `> Only <@${userId}> can interact with these buttons.`, 
                    ephemeral: true 
                });
            }

            const guild = interaction.guild;
            const embed = interaction.message.embeds[0];
            let currentPage = 1;
            let totalPages = 1;
            if (embed && embed.title) {
                const match = embed.title.match(/\[(\d+)\/(\d+)\]/);
                if (match) {
                    currentPage = parseInt(match[1]);
                    totalPages = parseInt(match[2]);
                }
            }
            let newPage = currentPage;
            if (action === 'next') {
                newPage = Math.min(currentPage + 1, totalPages);
            } else if (action === 'prev') {
                newPage = Math.max(currentPage - 1, 1);
            }
            const selectedRoleMatch = embed.title.match(/Mode:\s+(.+?)\s+\[\d+\/\d+\]/);
            const embedTitleMode = selectedRoleMatch ? selectedRoleMatch[1] : 'Staff';
            const selectedRole = allStaffRoles.find(role => role.name.toLowerCase() === embedTitleMode.toLowerCase());

            const memberList = guild.members.cache.filter(member => {
                if (selectedRole) return member.roles.cache.has(selectedRole.id);
                return member.roles.cache.some(role => allStaffRoles.map(r => r.id).includes(role.id));
            });

            const sortedMembersArray = Array.from(memberList.values()).sort((a, b) => {
                const roleIndexA = allStaffRoles.findIndex(role => a.roles.cache.has(role.id));
                const roleIndexB = allStaffRoles.findIndex(role => b.roles.cache.has(role.id));
                return 'ascending' === 'ascending' ? roleIndexA - roleIndexB : roleIndexB - roleIndexA;
            });

            const pageSize = 10;
            const totalPagesComputed = Math.ceil(sortedMembersArray.length / pageSize);
            totalPages = totalPagesComputed;
            newPage = Math.min(newPage, totalPages);
            const updatedEmbed = getPageEmbed(newPage, sortedMembersArray, guild, interaction, totalPages, embedTitleMode);
            const updatedButtons = getPaginationButtons(newPage, totalPages, userId);

            await interaction.update({ embeds: [updatedEmbed], components: [updatedButtons] });

            logger.info(`Staff list pagination: user ${userId} navigated to page ${newPage}/${totalPages}`);
        } catch (error) {
            logger.error(`Error in handlePagination: ${error}`);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ 
                    content: 'There was an error while processing your request!', 
                    ephemeral: true 
                });
            } else {
                await interaction.reply({ 
                    content: 'There was an error while processing your request!', 
                    ephemeral: true 
                });
            }
        }
    },

    /**
     * Exposes helper functions if needed elsewhere.
     */
    getPageEmbed,
    getPaginationButtons,
};
