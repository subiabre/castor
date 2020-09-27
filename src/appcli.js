"use strict";

const events = require('./events');
const Server = require("http").Server;
const Vorpal = require("vorpal");
const app = new Vorpal();
const ip = require('ip');
const os = require('os');
const fs = require('graceful-fs');
const filetype = require('file-type');
const mm = require('music-metadata');
const recursiveReadDir = require('recursive-readdir');
const stratter = require('stratter');
const SongModel = require('./models/songModel');

class AppCLI
{
    constructor()
    {
        app.log('Welcome to beacon CLI. Type "help" to see available commands.');

        app
            .delimiter(stratter(`beacon@${os.hostname()}`, { foreground: "blue" }) + ':')
            .show();

        this.listener = false;
    }

    /**
     * 
     * @param {Server} server 
     */
    server(server)
    {
        app.command('start [port]', 'Starts the listening server.')
        .alias('up')
        .action((args, callback) => {
            if (this.listener) {
                server.close();
            }

            // Launch server
            const listener = server.listen(args.port || process.env.PORT || 3127, async () => {
                this.netAddress = `http://${ip.address()}:${listener.address().port}`;
                this.localAddress = `http://localhost:${listener.address().port}`;
                this.listener = listener;
                
                app.log('beacon Server is now live!');
                app.log('Web address is:');
                app.log('On this machine: ' + this.localAddress);
                app.log('On this network: ' + this.netAddress);
            });

            callback();
        });

        app.command('stop', 'Stops the listening server.')
        .alias('down')
        .action((args, callback) => {
            if (!this.listener) {
                app.log('Server was already closed.');
                return callback();
            }

            server.close();
            app.log('Server stopped listening at the address ' + this.localAddress);

            this.netAddress = null;
            this.localAddress = null;
            this.listener = false;

            callback();
        });
    }

    data()
    {
        app.command('import <folder>', 'Import music from the given folder.')
        .action(async (args, callback) => {
            let folderExists = fs.existsSync(args.folder);

            if (!folderExists) {
                app.log(args.folder + 'is not a directory.');
            }

            let files = await recursiveReadDir(args.folder);
            
            for (let index = 0; index < files.length; index++) {
                let percentage = Math.round(index * 100 / files.length);
                let file = files[index];
                let type = await filetype.fromFile(file);

                if (!type || !type.mime.match(/audio\/.*/)) {
                    continue;
                }

                let data = await mm.parseFile(file)
                    .catch(err => {
                        app.log(`Error: could not read metadata of ${file}`);
                    });
                await SongModel.create({
                    file: file,
                    meta: data
                });

                app.ui.redraw(`Reading from ${args.folder}. ${index}/${files.length} (${percentage}%)`);
            }

            callback();
        });
    }

    sockets()
    {
        app.command('sockets', 'Shows the current socket list.')
        .option('-v', 'shows all the data.')
        .action(async (args, callback) => {
            let models = await events.getModels();
            let sockets = [];

            models.forEach((model, index) => {
                sockets[index] = {
                    id: model.dataValues.id,
                    userAgent: model.dataValues.userAgentOriginal,
                    online: model.dataValues.online,
                    connectedAt: model.dataValues.connectedAt
                }
            });

            if (args.options.v) {
                sockets = models;
            }

            if (sockets.length < 1) {
                sockets = 'There are no sockets connected.';
            }

            app.log(sockets);
            callback();
        });
    }
}

module.exports = new AppCLI;
