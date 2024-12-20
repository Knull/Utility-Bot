const { EmbedBuilder } = require('discord.js');

function createSimpleEmbed(description, color = '#FFFFFF') {
    return new EmbedBuilder().setDescription(description).setColor(color);
}

module.exports = { createSimpleEmbed };
