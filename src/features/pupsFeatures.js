const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');
const { pool } = require('../utils/database');

// Function to handle 'staff-list' command
async function handleStaffListCommand(interaction) {
    const sortBy = interaction.options.getString('sort-by') || 'owner';
    const order = interaction.options.getString('order') || 'ascending';

    // Define hierarchy levels
    const hierarchy = {
        'owner': 1,
        'head-developer': 2,
        'manager': 3,
        'developer': 4,
        'designer': 5,
        'admin': 6,
        'mod': 7,
        'helper': 8
    };

    try {
        // Fetch members with staff roles
        const staffRoles = [
            config.adminRoleId,
            config.managerRoleId,
            config.headDeveloperRoleId,
            config.developerRoleId,
            config.designerRoleId,
            config.modRoleId,
            config.helperRoleId,
            // Add other staff role IDs as needed
        ];

        const membersWithStaffRoles = await interaction.guild.members.fetch();
        const staffMembers = membersWithStaffRoles.filter(member =>
            member.roles.cache.some(role => staffRoles.includes(role.id))
        ).map(member => {
            // Determine the highest role based on hierarchy
            const highestRole = member.roles.cache
                .filter(role => staffRoles.includes(role.id))
                .sort((a, b) => hierarchy[a.name.toLowerCase()] - hierarchy[b.name.toLowerCase()])
                .first();
            return {
                username: member.user.username,
                role: highestRole.name
            };
        });

        // Sort staff members based on 'sort-by' and 'order'
        staffMembers.sort((a, b) => {
            if (hierarchy[a.role.toLowerCase()] < hierarchy[b.role.toLowerCase()]) return order === 'ascending' ? -1 : 1;
            if (hierarchy[a.role.toLowerCase()] > hierarchy[b.role.toLowerCase()]) return order === 'ascending' ? 1 : -1;
            return 0;
        });

        const pageSize = 10;
        const totalPages = Math.ceil(staffMembers.length / pageSize);
        let currentPage = 1;

        const paginatedStaff = staffMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        const staffList = paginatedStaff.map((member, index) => `\`\`${index + 1 + (currentPage - 1) * pageSize}.\`\` ${member.username} - ${member.role}`).join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Staff Members List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Sort By: **${sortBy.replace('-', ' ').toUpperCase()}**\nOrder: **${order.charAt(0).toUpperCase() + order.slice(1)}**\n\n${staffList}`)
            .setFooter({
                text: `Page ${currentPage} of ${totalPages}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor('#e96d6d')
            .setTimestamp();

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_staff_${interaction.user.id}_${currentPage}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId(`next_staff_${interaction.user.id}_${currentPage}`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === totalPages)
        );

        await interaction.reply({
            embeds: [embed],
            components: [buttons],
            ephemeral: false,
        });
    } catch (error) {
        console.error('Error fetching staff list:', error);
        await interaction.reply({ content: 'Error fetching staff list.', ephemeral: true });
    }
}

module.exports = { handleStaffListCommand };
