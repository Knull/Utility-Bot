const { EmbedBuilder } = require('discord.js');

const registerChannelId = '1300041846801829958';
const entranceChannelId = '1298246407752515627';

module.exports = (client) => {
    client.on('guildMemberAdd', async member => {
        // Welcome message in the entrance channel
        const entranceChannel = member.guild.channels.cache.get(entranceChannelId);
        if (entranceChannel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#90EE90')
                .setDescription(`# > ${member.user.username}\n> Enjoy your stay!`)
                .setFooter({
                    text: `We now have ${member.guild.memberCount} members!`,
                    iconURL: member.guild.iconURL(),
                })
                .setThumbnail(member.user.displayAvatarURL());

            entranceChannel.send({
                content: `<@${member.user.id}>, Welcome to Pika Ranked Bedwars!`,
                embeds: [welcomeEmbed],
            });
        }

        // Ghost ping in the register channel
        const registerChannel = member.guild.channels.cache.get(registerChannelId);
        if (registerChannel) {
            try {
                const ghostPingMessage = await registerChannel.send(`<@${member.user.id}>`);
                setTimeout(() => {
                    ghostPingMessage.delete().catch(err => console.error('Failed to delete ghost ping message:', err));
                }, 1000);
            } catch (error) {
                console.error('Error ghost pinging the member:', error);
            }
        }
    });
};
