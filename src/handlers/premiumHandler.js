const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

function getPremiumEmbedColor(interaction) {
    const premiumRole = interaction.guild.roles.cache.get(config.premiumRoleId);
    return premiumRole?.color || 0xc79504;
}

const errorColor = 0xe74c3c; 

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

    if (member.roles.cache.has(premiumRole.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${user.id}> already has the <@&${premiumRole.id}> role.`)
            .setColor(errorColor);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        await member.roles.add(premiumRole);
        console.log(`Added Premium role to user ${user.id}`);
        const embed = new EmbedBuilder()
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
            .setTitle('Premium Addition')
            .setDescription(`> <@${user.id}> has been added to <@&${premiumRole.id}>.\n- **Added by:** <@${interaction.user.id}>`)
            .setColor(getPremiumEmbedColor(interaction))
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });

        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.id === config.premiumChannelId);
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle('Premium Addition')
                .setDescription(`> <@${user.id}> has been added to <@&${premiumRole.id}>.\n- **Added by:** <@${interaction.user.id}>`)
                .setColor(getPremiumEmbedColor(interaction))
                .setTimestamp();

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

    if (!member.roles.cache.has(premiumRole.id)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${user.id}> does not have the <@&${premiumRole.id}> role.`)
            .setColor(errorColor);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    try {
        await member.roles.remove(premiumRole);
        console.log(`Removed Premium role from user ${user.id}`);
        const embed = new EmbedBuilder()
            .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
            .setTitle('Premium Removal')
            .setDescription(`> <@${user.id}> has been removed from <@&${premiumRole.id}>.\n- **Removed by:** <@${interaction.user.id}>`)
            .setColor(getPremiumEmbedColor(interaction))
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: false });

        // Announcement to the premium announcements channel
        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.id === config.premiumChannelId);
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
                .setTitle('Premium Removal')
                .setDescription(`> <@${user.id}> has been removed from <@&${premiumRole.id}>.\n- **Removed by:** <@${interaction.user.id}>`)
                .setColor(getPremiumEmbedColor(interaction))
                .setTimestamp();

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

    try {
        await interaction.guild.members.fetch();
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
            .setColor(0xe74c3c);
        return interaction.reply({ embeds: [noMembersEmbed], ephemeral: true });
    }

    let currentPage = 0;
    const paginatedMembers = membersArray.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
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
