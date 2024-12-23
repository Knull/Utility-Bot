const { PermissionFlagsBits } = require('discord.js');
const config = require('../config/config');

function getPermissionOverwrites(guild, userId, ticketType) {
    console.log(`--- Begin Permission Setup ---`);
    console.log(`Ticket Type: ${ticketType}`);
    console.log(`Guild ID: ${guild.id}, User ID: ${userId}`);
    
    // Ensure all IDs are strings
    const overwrites = [
      {
        id: String(guild.roles.everyone.id),
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: String(userId),
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ];
  
    // Function to safely map permissions
    const safeMapPermissions = (permissions) => permissions.map(p => p.toString());
  
    // Create a version of overwrites suitable for logging (convert BigInt to strings)
    const logOverwrites = overwrites.map(ow => ({
      id: ow.id,
      allow: ow.allow ? safeMapPermissions(ow.allow) : [],
      deny: ow.deny ? safeMapPermissions(ow.deny) : [],
    }));
    
    console.log('Base overwrites setup:', JSON.stringify(logOverwrites, null, 2));
  
    if (['General', 'Report'].includes(ticketType)) {
      console.log(`Adding permissions for Staff in General/Report ticket`);
      overwrites.push({
        id: String(config.staffRoleId),
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    } else if (['Staff Report', 'Partnership'].includes(ticketType)) {
      console.log(`Adding permissions for Admin in Staff Report/Partnership ticket`);
      overwrites.push({
        id: String(config.adminRoleId),
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      });
    } else if (ticketType === 'Appeal') {
      console.log(`Setting permissions for Appeal ticket (Admin only)`);
      overwrites.push(
        {
          id: String(config.staffRoleId),
          deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        },
        {
          id: String(config.adminRoleId),
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
        }
      );
    }
  
    // Create a final version of overwrites suitable for logging
    const finalLogOverwrites = overwrites.map(ow => ({
      id: ow.id,
      allow: ow.allow ? safeMapPermissions(ow.allow) : [],
      deny: ow.deny ? safeMapPermissions(ow.deny) : [],
    }));
    
    console.log(`Final overwrites for ticket type "${ticketType}":`, JSON.stringify(finalLogOverwrites, null, 2));
    console.log(`--- End Permission Setup ---`);
  
    return overwrites;
}

module.exports = { getPermissionOverwrites };
