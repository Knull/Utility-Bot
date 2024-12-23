const { EmbedBuilder } = require('discord.js');
const config = require('../config/config');

/**
 * Handles staff announcement commands: join, departure, return, promote
 * @param {Interaction} interaction - The command interaction
 * @param {Client} client - The Discord client
 */
async function handleStaffAnnouncement(interaction, client) {
    const { commandName, options, guild, member } = interaction;

    // Define restricted commands and their corresponding announcement details
    const announcementDetails = {
        join: {
            title: `New ${options.getRole('role').name}!`,
            description: `- ${options.getUser('user')} has joined the staff team as a **<@&${options.getRole('role').id}>**`,
        },
        departure: {
            title: `${options.getRole('role').name} Departure`,
            description: `- ${options.getUser('user')} is no longer a **<@&${options.getRole('role').id}>**`,
        },
        return: {
            title: `${options.getRole('role').name} Return`,
            description: `- ${options.getUser('user')} has returned to our staff team as a **<@&${options.getRole('role').id}>**`,
        },
        promote: {
            title: `${options.getRole('role').name} Promotion`,
            description: `- ${options.getUser('user')} has been promoted to **<@&${options.getRole('role').id}>**`,
        },
    };

    const details = announcementDetails[commandName];

    if (!details) {
        return interaction.editReply({
            content: 'Invalid command.',
            ephemeral: true,
        });
    }

    // Permission Check: Only Admin, Manager, HeadDeveloper, and Owner can use these commands
    const allowedRoleIds = [
        config.AdminRoleId,
        config.ManagerRoleId,
        config.HeadDeveloperRoleId,
        config.OwnerRoleId,
    ];

    const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

    if (!hasPermission) {
        const roleMentions = allowedRoleIds.map(roleId => `<@&${roleId}>`).join('\n');

        const embed = new EmbedBuilder()
            .setColor('#FF0000') // Red color for error
            .setTitle('Insufficient Permissions')
            .setDescription(`Only members with the following roles can use this command:\n${roleMentions}`)
            .setFooter({
                text: guild.name,
                iconURL: guild.iconURL(),
            })
            .setTimestamp();

        return interaction.editReply({ embeds: [embed], ephemeral: true });
    }

    // Fetch the announcement channel
    const announcementChannel = guild.channels.cache.get(config.announcementChannelId);
    if (!announcementChannel) {
        return interaction.editReply({
            content: 'Announcement channel not found.',
            ephemeral: true,
        });
    }

    // Fetch the user as a guild member
    const user = await guild.members.fetch(options.getUser('user').id).catch(() => null);
    if (!user) {
        return interaction.editReply({
            content: 'User not found in this server.',
            ephemeral: true,
        });
    }

    // Fetch the role
    const role = guild.roles.cache.get(options.getRole('role').id);
    if (!role) {
        return interaction.editReply({
            content: 'Role not found in this server.',
            ephemeral: true,
        });
    }

    // Create the embed
    const embed = new EmbedBuilder()
        .setFooter({
            text: guild.name,
            iconURL: guild.iconURL(),
        })
        .setTimestamp()
        .setColor(role.color || 0x00ae86)
        .setAuthor({
            name: details.title,
            iconURL: role.iconURL() || guild.iconURL(),
        })
        .setDescription(details.description);

    // Send the embed to the announcement channel
    await announcementChannel.send({ embeds: [embed] });

    // Confirm to the command user
    await interaction.editReply({
        content: `${capitalizeFirstLetter(commandName)} announcement sent.`,
        ephemeral: true,
    });
}

/**
 * Capitalizes the first letter of a string
 * @param {string} string 
 * @returns {string}
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = { handleStaffAnnouncement };
