const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function exportChatLogs(token, channelId, outputFile, limit = 100, tzInfo = 'UTC', militaryTime = false, callback) {
    const outputDir = 'exports';
    const outputPath = path.join(outputDir, outputFile);

    // Properly format the Python command
    const pythonCommand = `python3 main.py -t "${token}" -c ${channelId} -o "${outputPath}" -l ${limit} --tz_info "${tzInfo}" ${militaryTime ? '--military_time' : ''}`;
    
    exec(pythonCommand, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error exporting chat logs: ${stderr}`);
            return callback && callback(error); // Ensure callback is called with an error
        }
        console.log(`Export successful: ${stdout}`);
        
        // Ensure callback is a function
        if (typeof callback === 'function') {
            // Check if the file exists before proceeding
            fs.stat(outputPath, (err, stats) => {
                if (err) {
                    console.error(`File not found: ${outputPath}`);
                    return callback(new Error('Exported file not found'));
                }
                console.log(`File found: ${outputPath}`);
                callback(null, outputPath);
            });
        } else {
            console.error('Callback provided is not a function');
        }
    });
}

module.exports = { exportChatLogs };
