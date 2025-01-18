// handlers/staffAnnouncementHandler.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');
const logger = require('../utilities/logger'); // Ensure this logger is properly implemented

/**
 * Handles staff announcement commands: join, departure, return, promote
 * @param {Interaction} interaction - The command interaction
 * @param {Client} client - The Discord client
 */
async function handleStaffAnnouncement(interaction, client) {
    try {
        // Defer the reply to avoid InteractionNotReplied error
        await interaction.deferReply({ ephemeral: true });

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
            logger.warn(`Invalid staff announcement command: ${commandName}`);
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
            config.SeniorAdminRoleId,
        ];

        const hasPermission = member.roles.cache.some(role => allowedRoleIds.includes(role.id));

        if (!hasPermission) {
            const roleMentions = allowedRoleIds.map(roleId => `- <@&${roleId}>`).join('\n');

            const embed = new EmbedBuilder()
                .setColor('#FF0000') // Red color for error
                .setTitle('Insufficient Permissions')
                .setDescription(`Only members with the following roles can use this command:\n${roleMentions}`)
                .setFooter({
                    text: guild.name,
                    iconURL: guild.iconURL(),
                })
                .setTimestamp();

            logger.warn(`User ${interaction.user.id} attempted to use staff announcement without permissions.`);
            return interaction.editReply({ embeds: [embed], ephemeral: true });
        }

        // Fetch the announcement channel
        const announcementChannel = guild.channels.cache.get(config.announcementChannelId);
        if (!announcementChannel) {
            logger.error('Announcement channel not found.');
            return interaction.editReply({
                content: 'Announcement channel not found.',
                ephemeral: true,
            });
        }

        // Fetch the user as a guild member
        const user = await guild.members.fetch(options.getUser('user').id).catch(() => null);
        if (!user) {
            logger.warn(`User not found: ${options.getUser('user').id}`);
            return interaction.editReply({
                content: 'User not found in this server.',
                ephemeral: true,
            });
        }

        // Fetch the role
        const role = guild.roles.cache.get(options.getRole('role').id);
        if (!role) {
            logger.warn(`Role not found: ${options.getRole('role').id}`);
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

        // Log the successful announcement
        logger.info(`Staff announcement (${commandName}) sent for user ${user.id} by ${interaction.user.id}`);
    } catch (error) {
        logger.error(`Error in handleStaffAnnouncement: ${error}`);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ 
                content: 'There was an error while executing this interaction!', 
                ephemeral: true 
            });
        } else {
            await interaction.reply({ 
                content: 'There was an error while executing this interaction!', 
                ephemeral: true 
            });
        }
    }
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
