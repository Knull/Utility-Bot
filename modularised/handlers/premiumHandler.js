// handlers/premiumHandler.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

/**
 * Handles the /premium add and /premium remove subcommands.
 * @param {Interaction} interaction 
 */
async function handlePromoteCommand(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser('user');

    if (!user) {
        return interaction.reply({ content: 'User not found. Please provide a valid user.', ephemeral: true });
    }

    const member = interaction.guild.members.cache.get(user.id);
    if (!member) {
        return interaction.reply({ content: 'Member not found in this guild.', ephemeral: true });
    }

    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);
    if (!premiumRole) {
        return interaction.reply({ content: 'Premium role not found. Please check the configuration.', ephemeral: true });
    }

    const premiumManagerRole = interaction.guild.roles.cache.get(config.premiumManagerRoleId);
    if (!premiumManagerRole) {
        return interaction.reply({ content: 'Premium Manager role not found. Please check the configuration.', ephemeral: true });
    }

    // Check if the command user has the Premium Manager role
    if (!interaction.member.roles.cache.has(premiumManagerRole.id)) {
        return interaction.reply({ content: `Only <@&${config.premiumManagerRoleId}> can use this command.`, ephemeral: true });
    }

    if (subcommand === 'add') {
        await addPremiumRole(interaction, member, user);
    } else if (subcommand === 'remove') {
        await removePremiumRole(interaction, member, user);
    }
}

/**
 * Adds the Premium role to the target member.
 * @param {Interaction} interaction 
 * @param {GuildMember} member 
 * @param {User} user 
 */
async function addPremiumRole(interaction, member, user) {
    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);

    // Check if the user already has the Premium role
    if (member.roles.cache.has(premiumRole.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${user.id}> already has the <@&${premiumRole.id}> role.`)
            .setColor('#e74c3c'); // Red color for error
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add Premium role to the user
    try {
        await member.roles.add(premiumRole);
        console.log(`Added Premium role to user ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Added <@${user.id}> to <@&${premiumRole.id}>.`)
            .setColor('#c79504'); // Gold color for success

        await interaction.reply({ embeds: [embed], ephemeral: false });

        // Send announcement to premium-announcements channel
        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.name === 'premium-announcements');
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("Premium Addition")
                .setDescription(`<@${user.id}> has been added to <@&${premiumRole.id}>`)
                .addFields({ name: 'Added by:', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    } catch (error) {
        console.error('Error adding Premium role:', error);
        return interaction.reply({ content: 'Error adding Premium role. Please check my permissions.', ephemeral: true });
    }
}

/**
 * Removes the Premium role from the target member.
 * @param {Interaction} interaction 
 * @param {GuildMember} member 
 * @param {User} user 
 */
async function removePremiumRole(interaction, member, user) {
    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);

    // Check if the user has the Premium role
    if (!member.roles.cache.has(premiumRole.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${user.id}> does not have the <@&${premiumRole.id}> role.`)
            .setColor('#e74c3c'); // Red color for error
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Remove Premium role from the user
    try {
        await member.roles.remove(premiumRole);
        console.log(`Removed Premium role from user ${user.id}`);

        const embed = new EmbedBuilder()
            .setDescription(`Removed <@${user.id}> from <@&${premiumRole.id}>.`)
            .setColor('#c79504'); // Gold color for success

        await interaction.reply({ embeds: [embed], ephemeral: false });

        // Send announcement to premium-announcements channel
        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.name === 'premium-announcements');
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle("Premium Removal")
                .setDescription(`<@${user.id}> has been removed from <@&${premiumRole.id}>`)
                .addFields({ name: 'Removed by:', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    } catch (error) {
        console.error('Error removing Premium role:', error);
        return interaction.reply({ content: 'Error removing Premium role. Please check my permissions.', ephemeral: true });
    }
}

/**
 * Handles the /premium list subcommand.
 * @param {Interaction} interaction 
 */
async function handlePremiumList(interaction) {
    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);

    if (!premiumRole) {
        return interaction.reply({ content: 'Premium role not found in this server.', ephemeral: true });
    }

    // Fetch all members with the Premium role
    try {
        await interaction.guild.members.fetch(); // Ensure all members are cached
    } catch (error) {
        console.error('Error fetching guild members:', error);
        return interaction.reply({ content: 'Error fetching guild members.', ephemeral: true });
    }

    const membersWithRole = interaction.guild.members.cache.filter(member => member.roles.cache.has(premiumRole.id));
    const membersArray = Array.from(membersWithRole.values());

    const pageSize = 10;
    const totalPages = Math.ceil(membersArray.length / pageSize);

    if (totalPages === 0) {
        const noMembersEmbed = new EmbedBuilder()
            .setDescription('```ini\nNo members with Premium role found.\n```')
            .setColor(0x980e00); // Dark red color
        return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
    }

    let currentPage = 0; // Start with the first page
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

    await interaction.reply({
        embeds: [listEmbed],
        components: [buttons],
        ephemeral: false,
    });
}

module.exports = {
    handlePromoteCommand,
    handlePremiumList,
};
