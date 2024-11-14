// Import required modules and config
const { Events, EmbedBuilder } = require('discord.js');
const config = require('./config.js');

// Function to send a boost thank-you message
async function sendBoostMessage(member) {
    const boostsChannel = member.guild.channels.cache.get(config.BoostsChannelId);
    if (!boostsChannel) {
        console.error("Boosts channel not found!");
        return;
    }

    // Fetch the role to get its icon URL
    const heartRole = await member.guild.roles.fetch('1306597802377220149');
    const heartIconURL = heartRole.iconURL(); // Get the icon URL for the role

        const embed = new EmbedBuilder()
        .setAuthor({
            name: 'Thanks for Boosting PRBW!',
            iconURL: heartIconURL // Use the role icon URL as the icon
        })
        .setDescription(`<@&${config.BoosterRoleId}> **Perks**:\n- **VC Bypass**: You can join full VCs now!\n- **A Custom Role**: You may request a custom role!\n- \`=claimelo\`: A small token of our gratitude.\n- **Exclusive Giveaways**: Giveaways just for you!`)
        .setFooter({
            text: `${member.user.username}`, // Use member's username
            iconURL: member.user.displayAvatarURL() // Use member's avatar as the footer icon
        })
        .setTimestamp()
        .setColor('#ff79ce'); // Booster-themed color


    // Send the message to the boosts channel, pinging the booster
    await boostsChannel.send({
        content: `<@${member.id}>`, // Ping the booster outside the embed
        embeds: [embed]
    });

    console.log(`Boost message sent for ${member.user.tag}`);
}

// Event listener for guild member updates
module.exports = (client) => {
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const boostRoleId = config.BoosterRoleId;

        if (oldMember.partial) await oldMember.fetch();
        if (newMember.partial) await newMember.fetch();

        console.log('Guild member update detected');
        console.log('Old roles:', oldMember.roles.cache.map(role => role.id));
        console.log('New roles:', newMember.roles.cache.map(role => role.id));

        if (!oldMember.roles.cache.has(boostRoleId) && newMember.roles.cache.has(boostRoleId)) {
            console.log('Booster role added, sending message...');
            await sendBoostMessage(newMember);
        } else {
            console.log('No booster role change detected');
        }
    });
};
