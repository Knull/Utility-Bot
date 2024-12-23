// handlers/upgradeHandler.js
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const ms = require('ms'); // Ensure this package is installed
const config = require('../config/config');

/**
 * Handles the execution of the /upgrade command.
 * @param {Interaction} interaction 
 */
async function handlePromoteCommand(interaction) {
    const user = interaction.options.getUser('user');
    const tier = interaction.options.getString('tier');

    const guild = interaction.guild;
    const member = interaction.member; // The user who invoked the command
    const targetMember = await guild.members.fetch(user.id).catch(() => null);

    if (!targetMember) {
        return interaction.reply({ content: 'User not found in this server.', ephemeral: true });
    }

    // Check if the command user has manager roles
    const hasPupsManagerRole = member.roles.cache.has(config.pupsManagerRoleId);
    const hasPugsManagerRole = member.roles.cache.has(config.pugsManagerRoleId);
    const hasPremiumManagerRole = member.roles.cache.has(config.premiumManagerRoleId);

    // Check if the user has any of the manager roles
    if (!hasPupsManagerRole && !hasPugsManagerRole && !hasPremiumManagerRole) {
        // User does not have permission
        const embed = new EmbedBuilder()
            .setDescription(`Only people with the following roles can use this command:\n- <@&${config.pupsManagerRoleId}>\n- <@&${config.pugsManagerRoleId}>\n- <@&${config.premiumManagerRoleId}>`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Handle promotion based on the tier
    switch (tier) {
        case 'pups':
            if (hasPupsManagerRole || hasPugsManagerRole || hasPremiumManagerRole) {
                await promoteToPups(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        case 'pugs_trial':
            if (hasPugsManagerRole || hasPremiumManagerRole) {
                await promoteToPugsTrial(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        case 'pugs':
            if (hasPugsManagerRole || hasPremiumManagerRole) {
                await promoteToPugs(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        case 'premium':
            if (hasPremiumManagerRole) {
                await promoteToPremium(interaction, targetMember);
            } else {
                await denyPermission(interaction);
            }
            break;
        default:
            // Invalid tier selected
            await interaction.reply({ content: 'Invalid tier selected.', ephemeral: true });
    }
}

/**
 * Handles the autocomplete for the tier option.
 * @param {Interaction} interaction 
 */
async function handlePromoteAutocomplete(interaction) {
    const guild = interaction.guild;
    const member = interaction.member; // The user who invoked the command

    // Initialize options
    let options = [];

    // Check if the command user has any manager roles
    const hasPupsManagerRole = member.roles.cache.has(config.pupsManagerRoleId);
    const hasPugsManagerRole = member.roles.cache.has(config.pugsManagerRoleId);
    const hasPremiumManagerRole = member.roles.cache.has(config.premiumManagerRoleId);

    // Check if the command user has permission to promote
    if (!hasPupsManagerRole && !hasPugsManagerRole && !hasPremiumManagerRole) {
        options.push({ name: 'None', value: 'none' });
    } else {
        // Try to get the target user ID
        let targetUserId;

        // In an autocomplete interaction, options before the focused option are available
        const userOption = interaction.options.get('user');

        if (userOption && userOption.value) {
            targetUserId = userOption.value;
        } else {
            targetUserId = null;
        }

        if (!targetUserId) {
            // The user option hasn't been specified yet
            options.push({ name: 'Please select a user first.', value: 'none' });
        } else {
            // Fetch the target member using the user ID
            let targetMember;
            try {
                targetMember = await guild.members.fetch(targetUserId);
            } catch (error) {
                console.error('Error fetching target member:', error);
                options.push({ name: 'Error fetching user.', value: 'none' });
                await interaction.respond(
                    options.map(option => ({ name: option.name, value: option.value }))
                );
                return;
            }

            // Now proceed with your logic as before
            const targetRoles = targetMember.roles.cache;

            // Define role IDs for easier reference
            const pupsRoleId = config.pupsRoleId;
            const pugsTrialRoleId = config.pugsTrialRoleId;
            const pugsRoleId = config.pugsRoleId;
            const premiumRoleId = config.premiumRoleId;

            // Function to check if the target user has any of the specified roles
            const hasAnyRole = (roles) => roles.some(roleId => targetRoles.has(roleId));

            // Build options based on manager roles and target user's current roles
            if (hasPremiumManagerRole) {
                // Premium Manager can promote to any tier
                if (!targetRoles.has(premiumRoleId)) {
                    if (!targetRoles.has(pupsRoleId)) {
                        options.push({ name: 'PUPS', value: 'pups' });
                    }
                    if (!targetRoles.has(pugsTrialRoleId)) {
                        options.push({ name: 'PUGS Trial', value: 'pugs_trial' });
                    }
                    if (!targetRoles.has(pugsRoleId)) {
                        options.push({ name: 'PUGS', value: 'pugs' });
                    }
                    options.push({ name: 'Premium', value: 'premium' });
                } else {
                    options.push({ name: 'User is already at the highest tier.', value: 'none' });
                }
            } else if (hasPugsManagerRole) {
                // PUGS Manager
                if (targetRoles.has(pugsRoleId) || targetRoles.has(premiumRoleId)) {
                    options.push({ name: 'User is already PUGS or higher.', value: 'none' });
                } else if (targetRoles.has(pugsTrialRoleId)) {
                    options.push({ name: 'Promote to PUGS', value: 'pugs' });
                } else if (targetRoles.has(pupsRoleId)) {
                    options.push({ name: 'Promote to PUGS Trial', value: 'pugs_trial' });
                    options.push({ name: 'Promote to PUGS', value: 'pugs' });
                } else {
                    options.push({ name: 'PUPS', value: 'pups' });
                    options.push({ name: 'PUGS Trial', value: 'pugs_trial' });
                    options.push({ name: 'PUGS', value: 'pugs' });
                }
            } else if (hasPupsManagerRole) {
                // PUPS Manager
                if (hasAnyRole([config.pupsRoleId, config.pugsTrialRoleId, config.pugsRoleId, config.premiumRoleId])) {
                    options.push({ name: 'User is already PUPS or higher.', value: 'none' });
                } else {
                    options.push({ name: 'Promote to PUPS', value: 'pups' });
                }
            }
        }
    }

    // Respond to the autocomplete interaction
    await interaction.respond(
        options.map(option => ({ name: option.name, value: option.value }))
    );
}

/**
 * Denies permission to use the command.
 * @param {Interaction} interaction 
 */
async function denyPermission(interaction) {
    const embed = new EmbedBuilder()
        .setDescription(`You do not have permission to promote to this tier.\n> Only people with the appropriate roles can use this command.`)
        .setColor('#e74c3c');
    await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * Promotes a user to the PUPS tier.
 * @param {Interaction} interaction 
 * @param {GuildMember} targetMember 
 */
async function promoteToPups(interaction, targetMember) {
    // Check if the target user already has PUPS or higher roles
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.pupsRoleId) || targetRoles.has(config.pugsTrialRoleId) || targetRoles.has(config.pugsRoleId) || targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.pupsRoleId}> or higher.`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add PUPS role to the target user
    try {
        await targetMember.roles.add(config.pupsRoleId);
        console.log(`Added PUPS role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.pupsRoleId}>.`)
            .setColor('#e91e63');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to pups-voting channel
        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pups-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('PUPS Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.pupsRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#e91e63');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pups-voting channel not found.');
        }
    } catch (error) {
        console.error('Error adding PUPS role:', error);
        return interaction.reply({ content: 'Error adding PUPS role.', ephemeral: true });
    }
}

/**
 * Promotes a user to the PUGS Trial tier.
 * @param {Interaction} interaction 
 * @param {GuildMember} targetMember 
 */
async function promoteToPugsTrial(interaction, targetMember) {
    // Check if the target user already has PUGS Trial or higher roles
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.pugsTrialRoleId) || targetRoles.has(config.pugsRoleId) || targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.pugsTrialRoleId}> or higher.`)
            .setColor('#e74c3c');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add PUGS Trial role to the target user
    try {
        await targetMember.roles.add(config.pugsTrialRoleId);
        console.log(`Added PUGS Trial role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.pugsTrialRoleId}>.`)
            .setColor('#e74c3c');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to pugs-voting channel
        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('PUGS Trial Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.pugsTrialRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#e74c3c');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pugs-voting channel not found.');
        }
    } catch (error) {
        console.error('Error adding PUGS Trial role:', error);
        return interaction.reply({ content: 'Error adding PUGS Trial role.', ephemeral: true });
    }
}

/**
 * Promotes a user to the PUGS tier.
 * @param {Interaction} interaction 
 * @param {GuildMember} targetMember 
 */
async function promoteToPugs(interaction, targetMember) {
    // Check if the target user already has PUGS or higher roles
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.pugsRoleId) || targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.pugsRoleId}> or higher.`)
            .setColor('#b90d1a');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Remove PUGS Trial role if the user has it
    if (targetRoles.has(config.pugsTrialRoleId)) {
        await targetMember.roles.remove(config.pugsTrialRoleId);
    }

    // Add PUGS role to the target user
    try {
        await targetMember.roles.add(config.pugsRoleId);
        console.log(`Added PUGS role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.pugsRoleId}>.`)
            .setColor('#b90d1a');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to pugs-voting channel
        const votingChannel = interaction.guild.channels.cache.find(ch => ch.name === 'pugs-voting');
        if (votingChannel) {
            const votingEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('PUGS Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.pugsRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#b90d1a');

            await votingChannel.send({ embeds: [votingEmbed] });
        } else {
            console.error('pugs-voting channel not found.');
        }
    } catch (error) {
        console.error('Error adding PUGS role:', error);
        return interaction.reply({ content: 'Error adding PUGS role.', ephemeral: true });
    }
}

/**
 * Promotes a user to the Premium tier.
 * @param {Interaction} interaction 
 * @param {GuildMember} targetMember 
 */
async function promoteToPremium(interaction, targetMember) {
    // Check if the target user already has the Premium role
    const targetRoles = targetMember.roles.cache;
    if (targetRoles.has(config.premiumRoleId)) {
        const embed = new EmbedBuilder()
            .setDescription(`<@${targetMember.id}> is already <@&${config.premiumRoleId}>.`)
            .setColor('#c79504');
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Add Premium role to the target user
    try {
        await targetMember.roles.add(config.premiumRoleId);
        console.log(`Added Premium role to ${targetMember.user.username}`);

        // Reply to the interaction
        const replyEmbed = new EmbedBuilder()
            .setDescription(`Added <@${targetMember.id}> to <@&${config.premiumRoleId}>.`)
            .setColor('#c79504');

        await interaction.reply({ embeds: [replyEmbed], ephemeral: false });

        // Send announcement to premium-announcements channel
        const announcementChannel = interaction.guild.channels.cache.find(ch => ch.name === 'premium-announcements');
        if (announcementChannel) {
            const announcementEmbed = new EmbedBuilder()
                .setAuthor({ name: targetMember.user.username, iconURL: targetMember.user.displayAvatarURL() })
                .setTitle('Premium Addition')
                .setDescription(`<@${targetMember.id}> has been added to <@&${config.premiumRoleId}>`)
                .addFields({ name: 'Added by', value: `<@${interaction.user.id}>` })
                .setTimestamp()
                .setColor('#c79504');

            await announcementChannel.send({ embeds: [announcementEmbed] });
        } else {
            console.error('premium-announcements channel not found.');
        }
    } catch (error) {
        console.error('Error adding Premium role:', error);
        return interaction.reply({ content: 'Error adding Premium role.', ephemeral: true });
    }
}

module.exports = {
    handlePromoteCommand,
    handlePromoteAutocomplete,
};
