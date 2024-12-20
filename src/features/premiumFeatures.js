const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');
const { pool } = require('../utils/database');

// Function to handle adding Premium role
async function handlePremiumAdd(interaction) {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);

    // Check if the command user has the required role
    if (!interaction.member.roles.cache.has(config.premiumManagerRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`Only <@&${config.premiumManagerRoleId}> can add the Premium role.`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);
    if (!premiumRole) {
        return interaction.reply({ content: 'Premium role not found. Please check the configuration.', ephemeral: true });
    }

    try {
        await member.roles.add(premiumRole);
        console.log(`Added Premium role to user ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Added <@${user.id}> to <@&${premiumRole.id}>.`)
            .setColor('#c79504');

        await interaction.reply({ embeds: [embed], ephemeral: false });

        const announcementChannel = interaction.guild.channels.cache.get(config.premiumAnnouncementChannelId);
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle('Premium Addition')
                .setDescription(`<@${user.id}> has been added to <@&${premiumRole.id}>`)
                .addFields({ name: 'Added by:', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    } catch (error) {
        console.error(`Error adding Premium role to user ${user.id}:`, error);
        await interaction.reply({ content: 'Error adding Premium role.', ephemeral: true });
    }
}

// Function to handle removing Premium role
async function handlePremiumRemove(interaction) {
    const user = interaction.options.getUser('user');
    const member = await interaction.guild.members.fetch(user.id);

    // Check if the command user has the required role
    if (!interaction.member.roles.cache.has(config.premiumManagerRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`Only <@&${config.premiumManagerRoleId}> can remove the Premium role.`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);
    if (!premiumRole) {
        return interaction.reply({ content: 'Premium role not found. Please check the configuration.', ephemeral: true });
    }

    try {
        await member.roles.remove(premiumRole);
        console.log(`Removed Premium role from user ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Removed <@${user.id}> from <@&${premiumRole.id}>.`)
            .setColor('#c79504');

        await interaction.reply({ embeds: [embed], ephemeral: false });

        const announcementChannel = interaction.guild.channels.cache.get(config.premiumAnnouncementChannelId);
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle('Premium Removal')
                .setDescription(`<@${user.id}> has been removed from <@&${premiumRole.id}>`)
                .addFields({ name: 'Removed by:', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    } catch (error) {
        console.error(`Error removing Premium role from user ${user.id}:`, error);
        await interaction.reply({ content: 'Error removing Premium role.', ephemeral: true });
    }
}

// Function to handle listing Premium members
async function handlePremiumList(interaction) {
    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);
    if (!premiumRole) {
        return interaction.reply({ content: 'Premium role not found in this server.', ephemeral: true });
    }

    try {
        const membersWithRole = await interaction.guild.members.fetch();
        const membersArray = membersWithRole
            .filter(member => member.roles.cache.has(premiumRole.id))
            .map(member => member);

        const pageSize = 10;
        const totalPages = Math.ceil(membersArray.length / pageSize);

        if (totalPages === 0) {
            const noMembersEmbed = new EmbedBuilder()
                .setDescription('```ini\nNo members with Premium role found.\n```')
                .setColor(0x980e00);
            return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
        }

        let currentPage = 1; // Start with the first page
        const paginatedMembers = membersArray.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        const memberList = paginatedMembers
            .map((member, index) => `\`\`${index + 1 + (currentPage - 1) * pageSize}.\`\` <@${member.id}>`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Premium Members List', iconURL: interaction.guild.iconURL() })
            .setDescription(`Mode: **Premium** [${currentPage}/${totalPages}]\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n${memberList}\n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
            .setFooter({
                text: `${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setColor('#c79504');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`prev_premium_${interaction.user.id}_${currentPage}`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPage === 1),
            new ButtonBuilder()
                .setCustomId(`next_premium_${interaction.user.id}_${currentPage}`)
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
        console.error('Error listing Premium members:', error);
        await interaction.reply({ content: 'Error listing Premium members.', ephemeral: true });
    }
}

module.exports = { handlePremiumAdd, handlePremiumRemove, handlePremiumList };
