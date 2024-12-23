const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const config = require('../config/config');

const staffRoles = [
    config.OwnerRoleId,
    config.HeadDeveloperRoleId,
    config.ManagerRoleId,
    config.DeveloperRoleId,
    config.DesignerRoleId,
    config.AdminRoleId,
    config.ModRoleId,
    config.HelperRoleId,
];

module.exports = {
    async handleStaffListCommand(interaction, config) {
        await interaction.deferReply(); // Defer reply to avoid interaction timeout

        const sortBy = interaction.options.getString('sort-by');
        const order = interaction.options.getString('order') || 'ascending';
        const guild = interaction.guild;

        await guild.members.fetch();

        const allStaffRoles = [
            { name: 'Owner', id: config.OwnerRoleId },
            { name: 'Head Developer', id: config.HeadDeveloperRoleId },
            { name: 'Manager', id: config.ManagerRoleId },
            { name: 'Developer', id: config.DeveloperRoleId },
            { name: 'Designer', id: config.DesignerRoleId },
            { name: 'Admin', id: config.AdminRoleId },
            { name: 'Mod', id: config.ModRoleId },
            { name: 'Helper', id: config.HelperRoleId },
            { name: 'Staff Base Role', id: config.staffRoleId },
        ];

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
    },

    async handlePagination(interaction) {
        // Parse the customId to extract prefix, action, userId
        const [prefix, action, userId] = interaction.customId.split('_');

        // Ensure only the user who initiated the command can interact
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: `> Only <@${userId}> can run this command.`, ephemeral: true });
        }

        const guild = interaction.guild;

        // Extract the current page number from the embed's title
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

        // Determine the new page based on the action
        let newPage = currentPage;
        if (action === 'next') {
            newPage = Math.min(currentPage + 1, totalPages);
        } else if (action === 'prev') {
            newPage = Math.max(currentPage - 1, 1);
        }

        // Reconstruct the member list
        const allStaffRoles = [
            { name: 'Owner', id: config.OwnerRoleId },
            { name: 'Head Developer', id: config.HeadDeveloperRoleId },
            { name: 'Manager', id: config.ManagerRoleId },
            { name: 'Developer', id: config.DeveloperRoleId },
            { name: 'Designer', id: config.DesignerRoleId },
            { name: 'Admin', id: config.AdminRoleId },
            { name: 'Mod', id: config.ModRoleId },
            { name: 'Helper', id: config.HelperRoleId },
            { name: 'Staff Base Role', id: config.staffRoleId },
        ];

        await guild.members.fetch();

        // Retrieve sortBy and order if you have a way to retain them; otherwise, use default values
        const sortBy = null; // Replace with actual value if available
        const order = 'ascending'; // Replace with actual value if available

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
        const totalPagesComputed = Math.ceil(sortedMembersArray.length / pageSize);

        // Update totalPages in case it has changed
        totalPages = totalPagesComputed;

        const embedTitleMode = selectedRole ? selectedRole.name : 'Staff';

        // Create the updated embed and buttons
        const updatedEmbed = getPageEmbed(newPage, sortedMembersArray, guild, interaction, totalPages, embedTitleMode);
        const updatedButtons = getPaginationButtons(newPage, totalPages, userId);

        // Use interaction.update() to update the message
        await interaction.update({ embeds: [updatedEmbed], components: [updatedButtons] });
    },

    getPageEmbed(page, sortedMembersArray, guild, interaction, totalPages, embedTitleMode) {
        const pageSize = 10;
        const pageStartIndex = (page - 1) * pageSize;
        const pageMembers = sortedMembersArray.slice(pageStartIndex, pageStartIndex + pageSize);

        const embed = new EmbedBuilder()
            .setAuthor({ name: `Staff List`, iconURL: guild.iconURL() })
            .setTitle(`Mode: ${embedTitleMode} [${page}/${totalPages}]`)
            .setDescription(`▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${pageMembers.map((member, i) => `\`${pageStartIndex + i + 1}.\` <@${member.id}>`).join('\n')}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({
                text: `${sortedMembersArray.length} Staff Members`,
                iconURL: guild.iconURL(),
            });

        return embed;
    },

    getPaginationButtons(page, totalPages, userId) {
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
    },
};
